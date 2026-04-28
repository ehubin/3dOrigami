This is a single page js app  application which goal is to edit polyhedron shapes. Then the idea is to use the coordinates defined for these shapes to generate 3d models to be printed and to allow molding each face of the polyhedron independently. The main difficulty is to coompute the "sides" of the faces with the right angle so that they all fit together perfectly.
to achieve this i am trying to compute the medial axis of the shape. Then i could "translate" aeach polyhedron face inwards with the right bevelled edge on the side. I have documented some research paper on this in teh docs folder and have started a naive implementation of this algorithm but it is not fuunctional yet.

# Working with the docs/ folder

The `docs/` folder contains research papers (PDFs) on medial-axis
computation. To make them searchable without reopening the PDFs each
time, every PDF has a sibling `.txt` produced by `docs/_extract.py`
(uses `pypdf`, page banners are `===== PAGE k / N =====`). When asked
to read or browse the docs:

1. **First** consult `docs/README.md` — a one-line-per-paper index of
   what each PDF covers and the vocabulary used.
2. Use `Grep` against the `.txt` files for keyword searches.
3. Only fall back to `Read` on the PDF (with `pages:`) for figures,
   formulae, or anything `pypdf` extracted poorly.
4. After adding a new PDF to `docs/`, run `python docs/_extract.py` and
   add a row to the table in `docs/README.md` summarising it, so the
   next session can find it quickly.

`MedialSkeletalDiagram.pdf` is skipped by default (53 MB) — pass its
filename as an argument to `_extract.py` to force extraction.