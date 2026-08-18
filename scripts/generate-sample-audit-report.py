from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "verdict-sample-traffic-waste-audit.pdf"
PUBLIC_COPY = ROOT / "public" / "reports" / OUTPUT.name

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
BG = colors.HexColor("#09090B")
PANEL = colors.HexColor("#141416")
PANEL_2 = colors.HexColor("#1B1B1F")
INK = colors.HexColor("#F3F3F1")
MUTED = colors.HexColor("#A5A5AD")
MUTED_2 = colors.HexColor("#73737D")
LINE = colors.HexColor("#303036")
VIOLET = colors.HexColor("#8B87FF")
GREEN = colors.HexColor("#42B887")
AMBER = colors.HexColor("#E0A64B")
RED = colors.HexColor("#EF6A60")


def register_fonts():
    font_dir = Path("C:/Windows/Fonts")
    candidates = {
        "Body": font_dir / "arial.ttf",
        "BodyBold": font_dir / "arialbd.ttf",
        "Mono": font_dir / "consola.ttf",
        "MonoBold": font_dir / "consolab.ttf",
    }
    for name, path in candidates.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
    return {
        "body": "Body" if "Body" in pdfmetrics.getRegisteredFontNames() else "Helvetica",
        "body_bold": "BodyBold" if "BodyBold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold",
        "mono": "Mono" if "Mono" in pdfmetrics.getRegisteredFontNames() else "Courier",
        "mono_bold": "MonoBold" if "MonoBold" in pdfmetrics.getRegisteredFontNames() else "Courier-Bold",
    }


FONTS = register_fonts()


def style(name, size, leading=None, color=INK, font=None, align=TA_LEFT):
    return ParagraphStyle(
        name,
        fontName=font or FONTS["body"],
        fontSize=size,
        leading=leading or size * 1.3,
        textColor=color,
        alignment=align,
        splitLongWords=False,
    )


S = {
    "body": style("body", 8.5, 12.5, MUTED),
    "body_small": style("body-small", 7.5, 10.5, MUTED),
    "body_white": style("body-white", 8.5, 12, INK),
    "h1": style("h1", 30, 31, INK, FONTS["body_bold"]),
    "h2": style("h2", 21, 23, INK, FONTS["body_bold"]),
    "h3": style("h3", 11, 14, INK, FONTS["body_bold"]),
    "label": style("label", 6.7, 8, VIOLET, FONTS["mono_bold"]),
    "metric": style("metric", 19, 20, INK, FONTS["mono_bold"]),
    "metric_right": style("metric-right", 19, 20, INK, FONTS["mono_bold"], TA_RIGHT),
    "table": style("table", 7.2, 9.5, INK),
    "table_muted": style("table-muted", 6.8, 9, MUTED),
    "mono": style("mono", 7, 9, MUTED, FONTS["mono"]),
}


def rect(c, x, y, w, h, fill=PANEL, stroke=LINE, radius=4):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def p(c, text, x, y_top, width, st):
    block = Paragraph(text, st)
    _, h = block.wrap(width, PAGE_H)
    block.drawOn(c, x, y_top - h)
    return h


def header(c, page, section):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(VIOLET)
    c.roundRect(MARGIN, PAGE_H - MARGIN - 8, 8, 8, 2, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(FONTS["mono_bold"], 9)
    c.drawString(MARGIN + 14, PAGE_H - MARGIN - 1, "Verdict")
    c.setFillColor(MUTED_2)
    c.setFont(FONTS["mono"], 6.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN - 1, section.upper())
    c.setStrokeColor(LINE)
    c.line(MARGIN, PAGE_H - MARGIN - 15, PAGE_W - MARGIN, PAGE_H - MARGIN - 15)
    c.setFillColor(MUTED_2)
    c.setFont(FONTS["mono"], 6.2)
    c.drawString(MARGIN, 11 * mm, "SYNTHETIC SAMPLE - NO CLIENT DATA")
    c.drawRightString(PAGE_W - MARGIN, 11 * mm, f"Verdict / {page:02d}")


def metric_card(c, x, y, w, label, value, note, accent=VIOLET):
    rect(c, x, y, w, 31 * mm)
    c.setFillColor(accent)
    c.rect(x, y + 31 * mm - 1.4, w, 1.4, fill=1, stroke=0)
    p(c, label.upper(), x + 5 * mm, y + 25 * mm, w - 10 * mm, S["label"])
    p(c, value, x + 5 * mm, y + 17 * mm, w - 10 * mm, S["metric"])
    p(c, note, x + 5 * mm, y + 7 * mm, w - 10 * mm, S["mono"])


def page_one(c):
    header(c, 1, "Traffic Waste Audit")
    y = PAGE_H - 48 * mm
    p(c, "TRAFFIC WASTE AUDIT", MARGIN, y, 90 * mm, S["label"])
    y -= 12 * mm
    p(c, "Where media spend<br/>loses signal and value.", MARGIN, y, 150 * mm, S["h1"])
    y -= 30 * mm
    p(c, "A fixed-scope analysis of traffic quality, source risk and estimated media waste. Every decision is tied to an explicit signal and supporting evidence.", MARGIN, y, 132 * mm, style("lead", 11, 16, MUTED))

    badge_y = y - 38 * mm
    rect(c, MARGIN, badge_y, PAGE_W - 2 * MARGIN, 24 * mm, PANEL_2, colors.HexColor("#45406A"), 5)
    p(c, "SAMPLE PORTFOLIO", MARGIN + 6 * mm, badge_y + 17 * mm, 42 * mm, S["label"])
    p(c, "Synthetic Media Portfolio / August 2026", MARGIN + 6 * mm, badge_y + 9 * mm, 98 * mm, S["body_white"])
    p(c, "Analysis complete", PAGE_W - MARGIN - 50 * mm, badge_y + 14 * mm, 44 * mm, style("status", 8, 10, GREEN, FONTS["mono_bold"], TA_RIGHT))

    base_y = 42 * mm
    gap = 4 * mm
    card_w = (PAGE_W - 2 * MARGIN - gap) / 2
    metric_card(c, MARGIN, base_y + 35 * mm, card_w, "Requests analyzed", "2.0M", "100% of supplied rows")
    metric_card(c, MARGIN + card_w + gap, base_y + 35 * mm, card_w, "Review decisions", "24.0%", "9.2% watch / 14.8% block", AMBER)
    metric_card(c, MARGIN, base_y, card_w, "Potential waste", "$1,550", "14.8% of monitored spend", RED)
    metric_card(c, MARGIN + card_w + gap, base_y, card_w, "At-risk placements", "31", "of 284 traffic sources", RED)
    c.showPage()


def page_two(c):
    header(c, 2, "Executive summary")
    top = PAGE_H - 42 * mm
    p(c, "EXECUTIVE SUMMARY", MARGIN, top, 80 * mm, S["label"])
    p(c, "The finding in one page.", MARGIN, top - 10 * mm, 140 * mm, S["h2"])
    p(c, "The sample indicates a concentrated quality problem rather than portfolio-wide failure. Two sources account for most blocked spend; three additional placements need controlled review. The safest next move is a short shadow-mode remediation cycle, not blanket blocking.", MARGIN, top - 27 * mm, 158 * mm, style("summary", 10, 15, MUTED))

    y = top - 77 * mm
    gap = 4 * mm
    w = (PAGE_W - 2 * MARGIN - 2 * gap) / 3
    for idx, (label, value, note, accent) in enumerate([
        ("ALLOW", "76.0%", "Low configured risk", GREEN),
        ("WATCH", "9.2%", "Validate before action", AMBER),
        ("BLOCK", "14.8%", "Strong evidence present", RED),
    ]):
        metric_card(c, MARGIN + idx * (w + gap), y, w, label, value, note, accent)

    box_y = 35 * mm
    rect(c, MARGIN, box_y, PAGE_W - 2 * MARGIN, 61 * mm)
    p(c, "RECOMMENDED DECISION", MARGIN + 7 * mm, box_y + 52 * mm, 60 * mm, S["label"])
    p(c, "Pause two sources after buyer-side validation.", MARGIN + 7 * mm, box_y + 41 * mm, 150 * mm, S["h3"])
    recommendations = [
        "Confirm the declared domain and supply-chain identity for the two BLOCK sources.",
        "Apply temporary caps to the velocity outlier while retaining evidence.",
        "Re-run the same fingerprinted sample after 72 hours and compare spend movement.",
        "Enable automated action only after the shadow decision matches buyer policy.",
    ]
    yy = box_y + 30 * mm
    for item in recommendations:
        c.setFillColor(VIOLET)
        c.circle(MARGIN + 9 * mm, yy + 1.5, 1.5, fill=1, stroke=0)
        p(c, item, MARGIN + 14 * mm, yy + 4, 150 * mm, S["body_small"])
        yy -= 7.5 * mm
    c.showPage()


def page_three(c):
    header(c, 3, "Evidence")
    top = PAGE_H - 42 * mm
    p(c, "EVIDENCE DISTRIBUTION", MARGIN, top, 90 * mm, S["label"])
    p(c, "Why traffic entered review.", MARGIN, top - 10 * mm, 145 * mm, S["h2"])

    signals = [
        ("Domain mismatch", 38, RED),
        ("Incomplete supply chain", 27, RED),
        ("Abnormal request velocity", 18, AMBER),
        ("OS / User-Agent mismatch", 11, AMBER),
        ("High duplicate rate", 6, AMBER),
    ]
    chart_x = MARGIN
    chart_y = top - 40 * mm
    chart_w = PAGE_W - 2 * MARGIN
    for label, value, color in signals:
        p(c, label, chart_x, chart_y, 68 * mm, S["body_white"])
        bar_x = chart_x + 73 * mm
        bar_w = chart_w - 88 * mm
        c.setFillColor(PANEL_2)
        c.roundRect(bar_x, chart_y - 2, bar_w, 7, 3, fill=1, stroke=0)
        c.setFillColor(color)
        c.roundRect(bar_x, chart_y - 2, bar_w * value / 40, 7, 3, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONTS["mono_bold"], 7)
        c.drawRightString(PAGE_W - MARGIN, chart_y, f"{value}%")
        chart_y -= 17 * mm

    note_y = 43 * mm
    rect(c, MARGIN, note_y, PAGE_W - 2 * MARGIN, 42 * mm, PANEL_2)
    p(c, "HOW TO READ THIS", MARGIN + 7 * mm, note_y + 33 * mm, 55 * mm, S["label"])
    p(c, "Signals are evidence, not identity claims.", MARGIN + 7 * mm, note_y + 23 * mm, 150 * mm, S["h3"])
    p(c, "A BLOCK recommendation means configured evidence crossed the review threshold. It does not claim that every request came from a bot or that fraud is proven without buyer-side validation.", MARGIN + 7 * mm, note_y + 13 * mm, 158 * mm, S["body_small"])
    c.showPage()


def page_four(c):
    header(c, 4, "Source findings")
    top = PAGE_H - 42 * mm
    p(c, "SOURCE FINDINGS", MARGIN, top, 80 * mm, S["label"])
    p(c, "The placements to review first.", MARGIN, top - 10 * mm, 155 * mm, S["h2"])

    rows = [
        ["SOURCE", "PRIMARY EVIDENCE", "DECISION", "RISK", "AT-RISK"],
        ["premium-publisher.example", "Declared and observed domains differ", "BLOCK", "92", "$610"],
        ["seller-unknown / placement-31", "Missing seller identity in supply chain", "BLOCK", "85", "$420"],
        ["video-feed-07", "Request velocity above configured limit", "WATCH", "54", "$270"],
        ["app-zone-14", "Device OS conflicts with User-Agent", "WATCH", "47", "$160"],
        ["exchange-tail-09", "Duplicate rate above portfolio baseline", "WATCH", "34", "$90"],
    ]
    data = []
    for r_idx, row in enumerate(rows):
        data.append([
            Paragraph(cell, S["label"] if r_idx == 0 else (S["table_muted"] if c_idx == 1 else S["table"]))
            for c_idx, cell in enumerate(row)
        ])
    table = Table(data, colWidths=[49 * mm, 69 * mm, 22 * mm, 15 * mm, 21 * mm], rowHeights=[12 * mm] + [24 * mm] * 5)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PANEL_2),
        ("BACKGROUND", (0, 1), (-1, -1), PANEL),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (2, 1), (2, 2), RED),
        ("TEXTCOLOR", (2, 3), (2, 5), AMBER),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
    ]))
    table.wrapOn(c, PAGE_W - 2 * MARGIN, PAGE_H)
    table.drawOn(c, MARGIN, top - 165 * mm)

    p(c, "The five rows above account for the complete $1,550 potential-waste estimate in this synthetic sample. A client report includes all scored rows and exportable reason codes.", MARGIN, 39 * mm, 164 * mm, S["body_small"])
    c.showPage()


def page_five(c):
    header(c, 5, "Engagement")
    top = PAGE_H - 42 * mm
    p(c, "FIXED-SCOPE ENGAGEMENT", MARGIN, top, 100 * mm, S["label"])
    p(c, "From raw log to decision-ready report.", MARGIN, top - 10 * mm, 164 * mm, S["h2"])
    p(c, "The Traffic Waste Audit is the lowest-risk way to validate Verdict against real data before any live integration or automated buying action.", MARGIN, top - 27 * mm, 160 * mm, style("engagement-lead", 10, 15, MUTED))

    y = top - 112 * mm
    gap = 5 * mm
    col_w = (PAGE_W - 2 * MARGIN - gap) / 2
    sections = [
        ("CLIENT PROVIDES", ["7-30 days of JSON, JSONL or CSV", "One traffic source or buying platform", "Optional spend and conversion fields", "No production credentials required"]),
        ("Verdict DELIVERS", ["ALLOW / WATCH / BLOCK evidence", "Source-level waste estimate", "CSV evidence export", "Executive PDF and action plan"]),
    ]
    for idx, (title, items) in enumerate(sections):
        x = MARGIN + idx * (col_w + gap)
        rect(c, x, y, col_w, 63 * mm)
        p(c, title, x + 7 * mm, y + 53 * mm, col_w - 14 * mm, S["label"])
        yy = y + 42 * mm
        for item in items:
            c.setFillColor(VIOLET)
            c.circle(x + 8 * mm, yy + 1, 1.5, fill=1, stroke=0)
            p(c, item, x + 13 * mm, yy + 4, col_w - 20 * mm, S["body_small"])
            yy -= 11 * mm

    price_y = 38 * mm
    rect(c, MARGIN, price_y, PAGE_W - 2 * MARGIN, 49 * mm, colors.HexColor("#111018"), colors.HexColor("#4C4774"), 5)
    p(c, "TRAFFIC WASTE AUDIT", MARGIN + 7 * mm, price_y + 39 * mm, 75 * mm, S["label"])
    p(c, "First engagements from $750", MARGIN + 7 * mm, price_y + 28 * mm, 105 * mm, S["h3"])
    p(c, "Typical delivery: 3-5 business days. The audit fee can be credited toward an approved platform pilot.", MARGIN + 7 * mm, price_y + 17 * mm, 110 * mm, S["body_small"])
    p(c, "REQUEST AN AUDIT", PAGE_W - MARGIN - 52 * mm, price_y + 30 * mm, 45 * mm, style("request", 7, 9, VIOLET, FONTS["mono_bold"], TA_RIGHT))
    p(c, "adminez.sh", PAGE_W - MARGIN - 52 * mm, price_y + 18 * mm, 45 * mm, style("url", 11, 13, INK, FONTS["mono_bold"], TA_RIGHT))
    c.showPage()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Verdict Sample Traffic Waste Audit")
    c.setAuthor("Verdict")
    c.setSubject("Synthetic sample of a fixed-scope traffic-quality audit")
    for render in (page_one, page_two, page_three, page_four, page_five):
        render(c)
    c.save()
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(OUTPUT)


if __name__ == "__main__":
    build()
