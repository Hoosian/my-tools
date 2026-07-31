"""Command-line interface for docx-to-markdown."""

import argparse

from docx_to_markdown.converter import docx_to_markdown


def main():
    parser = argparse.ArgumentParser(description="Convert a Word document to Markdown.")
    parser.add_argument("input", help="Input .docx file")
    parser.add_argument("output", help="Output .md file")
    args = parser.parse_args()

    docx_to_markdown(args.input, args.output)
    print(f"Saved Markdown to: {args.output}")


if __name__ == "__main__":
    main()
