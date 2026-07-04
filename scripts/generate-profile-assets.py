#!/usr/bin/env python3
"""Generate the Profile HTML block and printable artist CV from one data file."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
from pathlib import Path

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "profile-data.json"
PROFILE_PATH = ROOT / "profile.html"
PDF_PATH = ROOT / "assets" / "documents" / "kome-ume-cv-ja.pdf"
START_MARKER = "<!-- PROFILE_DATA_START -->"
END_MARKER = "<!-- PROFILE_DATA_END -->"
SITE_URL = "https://komeueme-website.pages.dev/"


def load_data() -> dict:
    with DATA_PATH.open(encoding="utf-8") as source:
        data = json.load(source)

    required = ("updated", "name", "nameLatin", "birth", "field", "statement")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise ValueError(f"Missing profile fields: {', '.join(missing)}")

    for key in ("education", "awards", "exhibitions"):
        if not isinstance(data.get(key), list):
            raise ValueError(f"{key} must be a list")
        for entry in data[key]:
            if not entry.get("date") or not entry.get("text"):
                raise ValueError(f"{key} entries require date and text")
    return data


def render_entries(entries: list[dict]) -> str:
    return "\n".join(
        f"        <p>{html.escape(entry['date'])}　{html.escape(entry['text'])}</p>"
        for entry in entries
    )


def render_details(title: str, i18n_key: str, entries: list[dict], opened: bool) -> str:
    open_attr = " open" if opened else ""
    return f"""    <details class="card profile-accordion"{open_attr}>
      <summary><h2 data-i18n="{i18n_key}">{title}</h2></summary>
      <div class="profile-accordion-body">
{render_entries(entries)}
      </div>
    </details>"""


def build_profile_block(data: dict) -> str:
    profile = f"""    <details class="card profile-accordion" open>
      <summary><h2 data-i18n="card_profile_title">Profile</h2></summary>
      <div class="profile-accordion-body">
        <p><strong>{html.escape(data['name'])}</strong><br>{html.escape(data['birth'])}</p>
      </div>
    </details>"""
    sections = [
        profile,
        render_details("受賞歴", "profile_award_title", data["awards"], True),
        render_details("展示歴", "profile_exhibition_title", data["exhibitions"], True),
        render_details("学歴", "profile_edu_title", data["education"], False),
    ]
    return f"{START_MARKER}\n" + "\n\n".join(sections) + f"\n    {END_MARKER}"


def update_profile_html(data: dict) -> None:
    source = PROFILE_PATH.read_text(encoding="utf-8")
    generated = build_profile_block(data)
    pattern = re.compile(
        rf"{re.escape(START_MARKER)}.*?{re.escape(END_MARKER)}",
        flags=re.DOTALL,
    )
    if not pattern.search(source):
        raise RuntimeError("Profile generation markers are missing")
    updated = pattern.sub(generated, source, count=1)
    PROFILE_PATH.write_text(updated, encoding="utf-8")


def register_japanese_fonts() -> tuple[str, str]:
    regular_candidates = [
        os.environ.get("KOME_CV_FONT_REGULAR"),
        "/System/Library/Fonts/STHeiti Light.ttc",
    ]
    bold_candidates = [
        os.environ.get("KOME_CV_FONT_BOLD"),
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ]
    try:
        regular = next(Path(path) for path in regular_candidates if path and Path(path).exists())
        bold = next(Path(path) for path in bold_candidates if path and Path(path).exists())
        pdfmetrics.registerFont(TTFont("KomeJP", str(regular)))
        pdfmetrics.registerFont(TTFont("KomeJP-Bold", str(bold)))
        return "KomeJP", "KomeJP-Bold"
    except (StopIteration, Exception):
        pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
        return "HeiseiKakuGo-W5", "HeiseiKakuGo-W5"


def qr_drawing(value: str, size: float = 25 * mm) -> Drawing:
    widget = QrCodeWidget(value)
    x1, y1, x2, y2 = widget.getBounds()
    scale = size / max(x2 - x1, y2 - y1)
    drawing = Drawing(size, size, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    return drawing


def build_pdf(data: dict) -> None:
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    font_regular, font_bold = register_japanese_fonts()
    page_width, page_height = A4
    margin_x = 22 * mm
    margin_top = 19 * mm
    margin_bottom = 18 * mm
    frame = Frame(
        margin_x,
        margin_bottom,
        page_width - (margin_x * 2),
        page_height - margin_top - margin_bottom,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )

    def page_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#d7d9dc"))
        canvas.setLineWidth(0.45)
        canvas.line(margin_x, 13.5 * mm, page_width - margin_x, 13.5 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#777d85"))
        canvas.drawString(margin_x, 9.5 * mm, f"Kome Ume  |  Updated {data['updated']}")
        canvas.drawRightString(page_width - margin_x, 9.5 * mm, f"{doc.page}")
        canvas.restoreState()

    document = BaseDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=margin_x,
        rightMargin=margin_x,
        topMargin=margin_top,
        bottomMargin=margin_bottom,
        title=f"{data['name']} 作家略歴",
        author=data["name"],
        subject="作家略歴・受賞歴・展示歴・学歴",
        creator="Kome Ume portfolio profile generator",
    )
    document.addPageTemplates([PageTemplate(id="cv", frames=[frame], onPage=page_footer)])

    base = getSampleStyleSheet()
    name_style = ParagraphStyle(
        "Name",
        parent=base["Title"],
        fontName=font_bold,
        fontSize=23,
        leading=30,
        textColor=colors.HexColor("#17191c"),
        alignment=TA_LEFT,
        spaceAfter=2 * mm,
    )
    latin_style = ParagraphStyle(
        "Latin",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#737981"),
        spaceAfter=5 * mm,
    )
    field_style = ParagraphStyle(
        "Field",
        parent=base["Normal"],
        fontName=font_regular,
        fontSize=9.5,
        leading=15,
        textColor=colors.HexColor("#4f565f"),
        spaceAfter=7 * mm,
    )
    birth_style = ParagraphStyle(
        "Birth",
        parent=field_style,
        fontSize=8.5,
        leading=13,
        textColor=colors.HexColor("#737981"),
        spaceAfter=1.5 * mm,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=base["Heading2"],
        fontName=font_bold,
        fontSize=12,
        leading=17,
        textColor=colors.HexColor("#22262b"),
        spaceBefore=3 * mm,
        spaceAfter=3 * mm,
        borderColor=colors.HexColor("#cfd3d8"),
        borderWidth=0,
        borderPadding=0,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=base["BodyText"],
        fontName=font_regular,
        fontSize=8.7,
        leading=15,
        textColor=colors.HexColor("#30343a"),
        alignment=TA_LEFT,
    )
    date_style = ParagraphStyle(
        "Date",
        parent=body_style,
        fontSize=8,
        textColor=colors.HexColor("#68707a"),
        leading=13,
    )
    entry_style = ParagraphStyle(
        "Entry",
        parent=body_style,
        fontSize=8.3,
        leading=13,
    )
    contact_label_style = ParagraphStyle(
        "ContactLabel",
        parent=body_style,
        fontName=font_bold,
        fontSize=8.2,
        leading=13,
    )
    contact_style = ParagraphStyle(
        "Contact",
        parent=body_style,
        fontSize=8.2,
        leading=13,
        textColor=colors.HexColor("#424850"),
    )

    def rule():
        table = Table([[""]], colWidths=[page_width - margin_x * 2], rowHeights=[0.6 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (-1, -1), 0.45, colors.HexColor("#cfd3d8")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return table

    def section_heading(title: str):
        return KeepTogether([Paragraph(title, section_style), rule(), Spacer(1, 2.5 * mm)])

    def entries_table(entries: list[dict]):
        rows = [
            [
                Paragraph(html.escape(entry["date"]), date_style),
                Paragraph(html.escape(entry["text"]), entry_style),
            ]
            for entry in entries
        ]
        table = Table(rows, colWidths=[31 * mm, 133 * mm], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (0, -1), 4 * mm),
                    ("RIGHTPADDING", (1, 0), (1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.1 * mm),
                ]
            )
        )
        return table

    story = [
        Paragraph(html.escape(data["name"]), name_style),
        Paragraph(html.escape(data["nameLatin"]), latin_style),
        Paragraph(html.escape(data["birth"]), birth_style),
        Paragraph(html.escape(data["field"]), field_style),
        section_heading("作家ステートメント"),
        Paragraph(html.escape(data["statement"]), body_style),
        Spacer(1, 5 * mm),
        section_heading("学歴"),
        entries_table(data["education"]),
        Spacer(1, 2 * mm),
        section_heading("受賞歴"),
        entries_table(data["awards"]),
        PageBreak(),
        Paragraph("展示歴", name_style),
        Paragraph("EXHIBITIONS", latin_style),
        entries_table(data["exhibitions"]),
        Spacer(1, 4 * mm),
        section_heading("連絡先"),
    ]

    links = data["links"]
    contact_rows = [
        [
            Paragraph("Website", contact_label_style),
            Paragraph(f'<link href="{html.escape(links["website"])}" color="#424850">{html.escape(links["website"])}</link>', contact_style),
        ],
        [
            Paragraph("Instagram", contact_label_style),
            Paragraph(f'<link href="{html.escape(links["instagram"])}" color="#424850">@komeume1121</link>', contact_style),
        ],
        [
            Paragraph("Email", contact_label_style),
            Paragraph(f'<link href="mailto:{html.escape(links["email"])}" color="#424850">{html.escape(links["email"])}</link>', contact_style),
        ],
        [
            Paragraph("作品について", contact_label_style),
            Paragraph(f'<link href="{html.escape(links["inquiry"])}" color="#424850">Webサイト内のお問い合わせフォーム</link>', contact_style),
        ],
    ]
    contact_table = Table(contact_rows, colWidths=[29 * mm, 99 * mm], hAlign="LEFT")
    contact_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    contact_layout = Table(
        [[contact_table, qr_drawing(SITE_URL)]],
        colWidths=[133 * mm, 25 * mm],
        hAlign="LEFT",
    )
    contact_layout.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(contact_layout)

    document.build(story)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf-only",
        action="store_true",
        help="Generate only the PDF without rewriting profile.html",
    )
    args = parser.parse_args()
    data = load_data()
    if not args.pdf_only:
        update_profile_html(data)
    build_pdf(data)
    if not args.pdf_only:
        print(f"updated {PROFILE_PATH.relative_to(ROOT)}")
    print(f"generated {PDF_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
