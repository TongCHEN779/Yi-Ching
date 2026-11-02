"""Extract 64 hexagrams (卦辞/爻辞/象) from wikisource JSON into src/data.js."""
import json, re, sys
SRC = "/Users/tchen/Documents/Github/Classical-Chinese/sources/zhouyi"
TRI = {"乾":"111","兑":"110","离":"101","震":"100","巽":"011","坎":"010","艮":"001","坤":"000"}
# trigram bits are written bottom->top line
prog = json.load(open(f"{SRC}/progress.json"))
out = []
for pg in prog["pages"]:
    if not pg["slug"].startswith("gua"): continue
    d = json.load(open(f"{SRC}/wikisource/{pg['slug']}.json"))
    m = re.match(r"第(.+?)卦·(.+?)｜(.)下(.)上", pg["title"])
    num = int(pg["slug"][3:]); name = m.group(2); lo, up = m.group(3).replace("干","乾"), m.group(4).replace("干","乾")
    blocks = d["blocks"]; sec = None; guaci = None; yao = []; xiang = []; daxiang = None; tuan = None
    for b in blocks:
        if b["type"] == "head": sec = b["text"]; continue
        t = b["text"]
        if sec == "易经：":
            if b["type"] == "ul" and guaci is None: guaci = t
            elif b["type"] == "ol": yao.append(t)
        elif sec == "彖曰：" and tuan is None: tuan = t
        elif sec == "象曰：":
            if b["type"] == "ul" and daxiang is None: daxiang = t
            elif b["type"] == "ol": xiang.append(t)
    out.append(dict(n=num, name=name, lower=lo, upper=up,
                    bits=TRI[lo]+TRI[up],  # bottom->top, 6 chars
                    guaci=guaci, yao=yao[:6], extra=yao[6:], tuan=tuan,
                    daxiang=daxiang, xiao=xiang[:6]))
bad = [o for o in out if len(o["yao"])!=6 or not o["guaci"] or len(o["xiao"])<6 or not o["daxiang"]]
print(len(out), "hexagrams; problems:", [(o["n"],o["name"],len(o["yao"]),len(o["xiao"])) for o in bad])
assert len({o["bits"] for o in out}) == 64, "bits not unique"
open("src/data.js","w").write("window.HEXAGRAMS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
