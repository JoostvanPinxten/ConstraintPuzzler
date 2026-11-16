#!/usr/bin/env bash
# Build a debug-signed Android APK with pyside6-android-deploy.
#
#   android/build_apk.sh            # arm64 (phones, tablets); run from anywhere; Linux only
#   ARCH=x86_64 android/build_apk.sh  # x86_64 (emulators, Chromebooks)
#
# Needs: uv, git, a JDK 17 (JAVA_HOME), and the usual python-for-android host packages
# (autoconf, automake, libtool, pkg-config, cmake, zlib/libffi/libssl headers, zip, unzip).
# The Android NDK (r28c) is downloaded to ~/.pyside6_android_deploy and the SDK to ~/.buildozer
# on the first run. Set ANDROID_SDK_PATH to use an existing SDK instead.
#
# Output: dist/ConstraintPuzzler-<version>-android-<arm64|x86_64>.apk
#
# pyside6-android-deploy needs a main.py and regenerates buildozer.spec on every run, while the
# app also needs its example puzzles (*.txt) and pyproject.toml (for the version). So the app is
# staged in build/android/app (with pyproject.toml renamed, see utility/version.py), the deploy tool only runs with --init, and the generated
# buildozer.spec is patched before buildozer builds the APK.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/build/android"
APP="$WORK/app"
WHEELS="$WORK/wheels"
VENV="$WORK/venv"
ARCH=${ARCH:-aarch64}
case "$ARCH" in
    aarch64) ARCH_LABEL=arm64 ;;
    x86_64) ARCH_LABEL=x86_64 ;;
    *) echo "ARCH must be aarch64 or x86_64" >&2; exit 1 ;;
esac
QT_WHEELS_URL=https://download.qt.io/official_releases/QtForPython

cd "$ROOT"
VERSION=$(uv version --short)
PYSIDE_VERSION=$(uv run --no-project python - <<'EOF'
import tomllib
with open("uv.lock", "rb") as f:
    print(next(p["version"] for p in tomllib.load(f)["package"] if p["name"] == "pyside6"))
EOF
)
echo "ConstraintPuzzler $VERSION, PySide6 $PYSIDE_VERSION, $ARCH"

# Host tools: PySide6 (provides pyside6-android-deploy), buildozer and Cython, in a seeded venv
# (the deploy tool installs packages with pip).
if [[ ! -x "$VENV/bin/python" ]]; then
    uv venv --seed --python 3.13 "$VENV"
fi
uv pip install --python "$VENV/bin/python" "pyside6==$PYSIDE_VERSION" buildozer==1.6.0 cython==0.29.33
DEPLOY_REQUIREMENTS=$("$VENV/bin/python" -c     "import pathlib, PySide6; print(pathlib.Path(PySide6.__file__).parent / 'scripts' / 'requirements-android.txt')")
uv pip install --python "$VENV/bin/python" -r "$DEPLOY_REQUIREMENTS"
export VIRTUAL_ENV="$VENV" PATH="$VENV/bin:$PATH"

# The PySide6 and shiboken6 Android wheels are only published on download.qt.io.
mkdir -p "$WHEELS"
fetchWheel() {
    local package=$1 name
    name=$(curl -fsSL "$QT_WHEELS_URL/$package/" \
        | grep -oiE "$package-$PYSIDE_VERSION-$PYSIDE_VERSION-[a-z0-9_]+-[a-z0-9_]+-android_$ARCH\.whl" \
        | head -n 1)
    if [[ -z "$name" ]]; then
        echo "No $package $PYSIDE_VERSION Android wheel for $ARCH on $QT_WHEELS_URL" >&2
        exit 1
    fi
    if [[ ! -f "$WHEELS/$name" ]]; then
        curl -fL --retry 3 -o "$WHEELS/$name.part" "$QT_WHEELS_URL/$package/$name"
        mv "$WHEELS/$name.part" "$WHEELS/$name"
    fi
    echo "$WHEELS/$name"
}
PYSIDE_WHEEL=$(fetchWheel pyside6 | tail -n 1)
# Keep only the Qt libraries the app needs (the full wheel makes a ~170 MB APK).
SLIM_WHEEL="$WORK/slim/$(basename "$PYSIDE_WHEEL")"
mkdir -p "$WORK/slim"
python android/slim_wheel.py "$PYSIDE_WHEEL" "$SLIM_WHEEL"
PYSIDE_WHEEL="$SLIM_WHEEL"
SHIBOKEN_WHEEL=$(fetchWheel shiboken6 | tail -n 1)

# Stage the app: the tracked sources and data files, without tests, docs and CI files.
rm -rf "$APP"
mkdir -p "$APP"
git ls-files -z -- '*.py' '*.txt' pyproject.toml \
    | grep -zvE '(^|/)tests/|^(doc|android|\.github|\.claude)/|^constraintpuzzler\.spec$' \
    | xargs -0 cp --parents -t "$APP"
cp android/main.py "$APP/main.py"
# python-for-android leaves out everything but main.py when the app has a pyproject.toml.
mv "$APP/pyproject.toml" "$APP/project-metadata.toml"
cp doc/logo/constraintpuzzler-mark-512.png "$APP/icon.png"

cd "$APP"
DEPLOY_ARGS=(--name ConstraintPuzzler --wheel-pyside "$PYSIDE_WHEEL"
    --wheel-shiboken "$SHIBOKEN_WHEEL" --init --keep-deployment-files --force --verbose)
if [[ -n "${ANDROID_SDK_PATH:-}" ]]; then
    DEPLOY_ARGS+=(--sdk-path "$ANDROID_SDK_PATH")
fi
pyside6-android-deploy "${DEPLOY_ARGS[@]}"
test -f buildozer.spec

python - "$VERSION" <<'EOF'
"""Patch the [app] section of the buildozer.spec that pyside6-android-deploy generated."""

import re
import sys

settings = {
    "package.name": "constraintpuzzler",
    "package.domain": "io.github.joostvanpinxten",
    "version": sys.argv[1],
    "source.exclude_dirs": "bin,deployment",
    "orientation": "portrait, landscape",
    "icon.filename": "%(source.dir)s/icon.png",
    "android.accept_sdk_license": "True",
}
with open("buildozer.spec") as f:
    lines = f.read().splitlines()

# Drop the existing (and commented-out) lines for these keys and append the values at the end
# of [app]: buildozer rejects duplicate keys.
out = []
section = None
for line in lines:
    header = re.match(r"\s*\[(.+)\]\s*$", line)
    if header:
        if section == "app":
            out += [f"{k} = {v}" for k, v in settings.items()]
        section = header.group(1)
    key = re.match(r"\s*#?\s*([\w.\-]+)\s*=", line)
    if section == "app" and key and key.group(1) in settings:
        continue
    if section == "app" and key and line.startswith("source.include_exts"):
        line = f"{line.rstrip()},txt,toml"
    out.append(line)
if section == "app":
    out += [f"{k} = {v}" for k, v in settings.items()]

with open("buildozer.spec", "w") as f:
    f.write("\n".join(out) + "\n")
EOF
grep -E '^(title|package\.|version|source\.|orientation|icon\.|requirements|android\.(archs|api|minapi|accept)|p4a\.)' buildozer.spec

python -m buildozer android debug

mkdir -p "$ROOT/dist"
APK=$(find "$APP" -name '*.apk' -newer buildozer.spec | head -n 1)
if [[ -z "$APK" ]]; then
    echo "buildozer did not produce an APK" >&2
    exit 1
fi
OUTPUT="$ROOT/dist/ConstraintPuzzler-$VERSION-android-$ARCH_LABEL.apk"
cp "$APK" "$OUTPUT"
echo "APK: $OUTPUT"
