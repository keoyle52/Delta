import os

md_path = "/mnt/c/Users/Berat/Desktop/Delta/docs/SUBMISSION_DOCUMENT.md"

with open(md_path, "r", encoding="utf-8") as f:
    content = f.read()

target = "| **Video Demonstration** | [https://www.youtube.com/watch?v=p5U0WwiAHbA](https://www.youtube.com/watch?v=p5U0WwiAHbA) |"
replacement = target + "\n| **Live Web App URL** | [https://delta-omega-black.vercel.app](https://delta-omega-black.vercel.app) |"

if target in content and "delta-omega-black.vercel.app" not in content:
    content = content.replace(target, replacement)

with open(md_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated Live URL in SUBMISSION_DOCUMENT.md")
