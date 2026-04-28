"""Extract text from PDFs in this folder and save as .txt for quick grepping.

Skips MedialSkeletalDiagram.pdf (too large) by default.
"""
import sys
from pathlib import Path
from pypdf import PdfReader

HERE = Path(__file__).parent
SKIP = {"MedialSkeletalDiagram.pdf"}

def extract(pdf_path: Path) -> None:
    out = pdf_path.with_suffix(".txt")
    print(f"-> {pdf_path.name} ({pdf_path.stat().st_size//1024} KB)")
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:
        print(f"   ! failed to open: {e}")
        return
    n = len(reader.pages)
    chunks = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            text = f"[extraction error on page {i+1}: {e}]"
        chunks.append(f"\n\n===== PAGE {i+1} / {n} =====\n\n{text}")
    out.write_text("".join(chunks), encoding="utf-8")
    print(f"   wrote {out.name} ({out.stat().st_size//1024} KB, {n} pages)")

def main():
    only = set(sys.argv[1:])
    for pdf in sorted(HERE.glob("*.pdf")):
        if pdf.name in SKIP and not only:
            print(f"-- skipping {pdf.name} (large; pass filename as arg to force)")
            continue
        if only and pdf.name not in only:
            continue
        extract(pdf)

if __name__ == "__main__":
    main()
