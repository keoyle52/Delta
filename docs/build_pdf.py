import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

pdf_path = "/mnt/c/Users/Berat/Desktop/Delta/docs/SUBMISSION_DOCUMENT.pdf"
md_path = "/mnt/c/Users/Berat/Desktop/Delta/docs/SUBMISSION_DOCUMENT.md"

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=40,
    leftMargin=40,
    topMargin=40,
    bottomMargin=40
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#0052FF'),
    spaceAfter=8
)

h2_style = ParagraphStyle(
    'H2',
    parent=styles['Heading2'],
    fontSize=13,
    leading=17,
    textColor=colors.HexColor('#1E293B'),
    spaceBefore=12,
    spaceAfter=6
)

h3_style = ParagraphStyle(
    'H3',
    parent=styles['Heading3'],
    fontSize=10.5,
    leading=14,
    textColor=colors.HexColor('#334155'),
    spaceBefore=8,
    spaceAfter=4
)

body_style = ParagraphStyle(
    'Body',
    parent=styles['BodyText'],
    fontSize=9,
    leading=13,
    textColor=colors.HexColor('#1E293B'),
    spaceAfter=4
)

def clean_markdown_line(text):
    # Escape XML/HTML characters
    t = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    # Replace markdown links [text](url) with simple text
    t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t)
    # Convert **bold** pairs to <b>bold</b>
    parts = t.split('**')
    res = []
    for idx, part in enumerate(parts):
        if idx % 2 == 1:
            res.append(f'<b>{part}</b>')
        else:
            res.append(part)
    return ''.join(res)

story = []

with open(md_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    line_clean = line.strip()
    if not line_clean:
        continue
    if line_clean.startswith('# '):
        story.append(Paragraph(clean_markdown_line(line_clean[2:]), title_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0052FF'), spaceAfter=8))
    elif line_clean.startswith('## '):
        story.append(Spacer(1, 4))
        story.append(Paragraph(clean_markdown_line(line_clean[3:]), h2_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CBD5E1'), spaceAfter=6))
    elif line_clean.startswith('### '):
        story.append(Paragraph(clean_markdown_line(line_clean[4:]), h3_style))
    elif line_clean.startswith('---'):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E2E8F0'), spaceBefore=6, spaceAfter=6))
    else:
        story.append(Paragraph(clean_markdown_line(line_clean), body_style))

doc.build(story)
print("PDF compilation successful:", pdf_path)
