"""CLI entry point for the strikethrough remover."""

import argparse

from .remover import remove_strikethrough


def main():
    parser = argparse.ArgumentParser(
        description="Remove strikethrough text from a Word document."
    )
    parser.add_argument("input", help="Input .docx file path")
    parser.add_argument("output", help="Output .docx file path")
    args = parser.parse_args()

    remove_strikethrough(args.input, args.output)
    print(f"Saved cleaned document to: {args.output}")


if __name__ == "__main__":
    main()
