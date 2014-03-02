ConstraintPuzzler - the power of deduction
==========================================

Many number puzzles have many similar properties which allow automatic (analytical or brute-force) solving. ConstraintPuzzler takes advantage of these similarities by allowing the user to describe the structure of the puzzle. As you can express most puzzles in terms of (combinations of) constraints on this structure, it leverages this information to automatically provide a solver that simply interprets the constraints + structure and analytically solves most cases.

In short, ConstraintPuzzler uses _the power of deduction_ to solve these puzzles.

Usage instructions
=================

ConstraintPuzzler is a Python GUI application.

## Usage dependencies
ConstraintPuzzler needs Python 2.7 and uses [Qt via PySide](http://qt-project.org/wiki/Category:LanguageBindings::PySide::Downloads).

## Running an example
In the root folder of the project, the *Main.py files are the entry files. These files contain a very dumb parser for reading a file format specific to the puzzle. Apart from the parser, each *Main.py file contains subclass of BasicMainWindow that determines the specific layout and shapes of the puzzle.

Development
==================
Due to the nature of the ConstraintPuzzler, there are several ways to do some development:
- Creating new puzzles based on pre-defined constraints and cell visualizations;
- Introduce a new kind of Constraint, by implmeneting the contract defined by the Constraint class;
- Create your own fancy shapes for visualizing a puzzle, including animation;
- Improving the main algorithm that distributes the logic to the proper places.

I would be happy to see new kinds of puzzles being tackled, be it with existing constraints or with new ones.

How to report issues
==================
As I am interested in the different usages of the ConstraintPuzzler, I would like to have some backgroud information on the type of puzzle that you are trying to create.

If you report an issue, you may be asked to provide the following technical information:

- Which platform you are using (Unix, Windows, OSX, etc.)
- Which version of Python you are using (e.g. 2.7.2)
- Which version of PySide you have installed (e.g. 1.2.1)
- In what way you started your ConstraintPuzzler
