const field = (key, label, placeholder, required = true) => ({ key, label, placeholder, required });
const section = (key, title, prompt, children = []) => ({ key, title, prompt, children });
const col = (key, label, width, type = "text") => ({ key, label, width, type });
const table = (id, title, after, columns, required = false) => ({ id, title, after, columns, required });

const title = field("title", "計畫名稱", "輸入計畫或作品名稱");
const issueDate = field("date", "文件日期", "民國 115 年 12 月 28 日", false);
const period = field("period", "執行期間", "民國 115 年 9 月至 116 年 1 月");
const contestFields = [
  field("year", "競賽年度", "115"),
  field("category", "參賽群別", "電機與電子群"),
  { ...title, label: "作品名稱" },
  field("keywords", "關鍵詞", "以頓號分隔，例如感測、視覺化、節能"),
];
const schedule = (after) => table("schedule", "工作時程", after, [
  col("task", "工作項目", 29), col("start", "開始", 15), col("end", "結束", 15),
  col("owner", "負責人", 16), col("progress", "進度／產出", 25),
]);
const team = (after) => table("team", "作品分工表", after, [
  col("member", "成員", 19), col("role", "負責工作", 44), col("share", "比重（%）", 15, "number"),
  col("evidence", "成果", 22),
]);
const journal = (after) => table("journal", "競賽日誌", after, [
  col("date", "日期", 17), col("milestone", "進度", 21), col("notes", "製作紀錄", 38), col("owner", "工作分配", 24),
]);
const tests = (after) => table("tests", "驗證結果", after, [
  col("item", "驗證項目", 26), col("method", "條件與方法", 29), col("target", "基準／預期", 23),
  col("result", "實測結果", 22),
]);
const references = (after) => table("references", "引用資料", after, [
  col("source", "作者／機構與題名", 40), col("date", "日期", 16), col("link", "網址／出版資訊", 44),
]);
const catalog = [
  { key:"course", name:"期末專題計畫", icon:"graduation", kind:"課程報告", coverTitle:"專題計劃書面報告",
    introduction:"適合呈現專題的提案、執行進度與成員分工。",
    fields:[field("institution","學校與系所","輸入學校及系所名稱"),field("term","學年度與報告階段","115 學年度上學期 期末報告"),
      { ...title, label:"專題題目" },field("members","成員與學號","輸入學號、姓名，可分行"),field("advisor","指導老師","輸入老師姓名"),issueDate],
    sections:[
      section("abstract","摘要","交代研究背景、方法與目前成果。"),
      section("motivation","動機","說明希望改善的問題，以及這個問題對誰重要。"),
      section("problem","簡介與問題描述","定義使用情境、問題範圍與可衡量的目標。"),
      section("literature","文獻回顧","整理既有方法，說明本專題如何承接或改進。"),
      section("method","提出方法","描述架構、資料來源、實作步驟與測試方法。"),
      section("progress","專題時程規劃與目前進度","交代里程碑、預定時程及目前完成的工作。"),
      section("division","專題計畫分工狀況","說明各成員負責的工作、貢獻比重與具體產出。"),
      section("reflection","自評與將來的工作","根據目前成果自評，說明未達成的目標與後續工作。"),
      section("references","參考文獻","可用編號逐條列出引用資料，或使用表格。"),
    ],
    tables:[schedule("progress"),team("division"),references("references")],
    numbering:"course", contents:false, coverImage:false, bodyFont:"DFKai-SB", fontSize:12, margin:[72,63.7,72,90],
    note:"範例正文寫明 12 點標楷體、5–10 頁及每頁至少 300 字。原檔內文以「期中報告」敘述，交件請依授課要求確認。",
  },
  { key:"contest-project", name:"競賽專題組", icon:"flask", kind:"作品說明書", coverTitle:"「專題組」作品說明書",
    introduction:"按專題研究流程說明課程關聯、方法、實測結果與討論。",
    fields:contestFields,
    sections:[
      section("abstract","摘要","交代目的、實作方法、驗證結果及結論。"),
      section("motivation","研究動機","從可觀察的問題出發，提出研究目的與欲驗證的問題。"),
      section("curriculum","主題與課程之相關性或教學單元之說明","列出課程或教學單元，說明具體應用之處。"),
      section("method","研究方法","說明時程、設計流程、軟硬體與驗證方法。"),
      section("results","研究結果","呈現原型、實測資料、操作結果與證據。"),
      section("discussion","討論","解釋結果，分析異常、限制及改進方向。"),
      section("conclusion","結論","回應研究目的與成果，簡潔說明貢獻。"),
      section("references","參考資料及其他","標明資料來源、作者或機構、日期與網址。"),
      section("appendix","附錄","補充作品分工、競賽日誌、操作說明或程式與圖表。"),
    ],
    tables:[schedule("method"),tests("results"),references("references"),team("appendix"),journal("appendix")],
    numbering:"formal", contents:true, coverImage:true, bodyFont:"DFKai-SB", fontSize:12, margin:[66,66,66,66],
    note:"五份專題組案例共同呈現摘要、動機、課程關聯、方法、成果與結論。木光記將部分資料併入附錄，也有案例省略獨立圖表目錄。",
  },
  { key:"contest-creative", name:"競賽創意組", icon:"spark", kind:"作品說明書", coverTitle:"「創意組」作品說明書",
    introduction:"從創意發想切入，呈現差異化設計、操作方式與製作迭代。",
    fields:contestFields,
    sections:[
      section("motivation","創意動機及目的","說明使用情境、想解決的問題與作品目標。"),
      section("novelty","作品特色與創意特質","與現有做法比較，指出具體的原創設計。"),
      section("design","創意發想與設計過程","列出構想、方案取捨、模組與設計過程。"),
      section("principles","設計相關原理","說明主要機構、電路、程式或其他技術原理。"),
      section("operation","作品功用與操作方式","說明操作步驟、使用限制與展示成果。"),
      section("production","製作歷程說明","交代原型、驗證、遇到的問題與改善過程。"),
      section("appendix","附錄","補充分工表、競賽日誌、參考文獻及支援資料。"),
    ],
    tables:[schedule("production"),tests("production"),team("appendix"),journal("appendix"),references("appendix")],
    numbering:"formal", contents:true, coverImage:true, bodyFont:"DFKai-SB", fontSize:12, margin:[66,66,66,66],
    note:"ATLAS 獵星者以創意、原理、操作與製作歷程為主，分工、日誌和參考文獻置於附錄。",
  },
  { key:"guidance", name:"輔導計畫", icon:"briefcase", kind:"申請計畫書", coverTitle:"輔導計畫書",
    introduction:"適合需要申請紀錄、輔導雙方資料、查核點、預算與移交成果的申請。",
    fields:[field("program","申請方案","填寫方案正式名稱"),title,
      field("provider","輔導單位","填寫公司或機構全名"),field("recipient","受輔導單位","填寫公司或機構全名"),
      period,field("organizer","主辦單位","填寫主辦單位",false),field("agency","委辦單位","填寫委辦單位",false),issueDate],
    front:[
      section("history","申請紀錄說明","分別說明兩方近三年參與的政府計畫及本次差異；無申請紀錄填「無」。"),
      section("summary","輔導計畫摘要","概述計畫重點及結案後三年的預期成果。"),
    ],
    sections:[
      section("company","公司概況","輔導單位與受輔導單位皆須說明。",
        [section("companyBackground","背景說明","分列公司簡介、經營狀況、產品銷售、主要產品與競爭比較。"),
         section("workplace","經營理念與營造友善職場環境之規劃","說明友善措施、員工組成、留才做法及志願役退伍軍人聘任情形。")]),
      section("context","緣起","說明計畫形成原因。",
        [section("background","計畫背景說明","說明目前產業現況與趨勢。"), section("scenario","應用情境說明","比較現況、問題與導入後情境。"), section("objectives","計畫目標說明","提出可查核的最終目標。")]),
      section("plan","計畫內容","概述計畫範圍。",
        [section("architecture","計畫架構說明","列出工作分項與資安工作。"), section("workPackages","各分項實施方法說明","說明各分項的執行方式，可附架構圖。"),
         section("validation","各分項功能規格及驗證方法說明","列出功能與通過條件。"), section("siteRollout","場域導入規劃","說明導入環境、對象與時機。"),
         section("moduleTesting","AI 應用服務模組驗證規劃","交代資料、測試環境與評估方式。"), section("upgrade","產線升級內容說明","以可追蹤的數據描述效益。"),
         section("risks","可能遭遇之困難與解決方法","列出風險及對應做法。"), section("scaling","未來發展方向","說明產業複製及擴散規劃。")]),
      section("product","擬輔導產品及技術介紹","整體說明產品及技術。",
        [section("functions","功能及用途","說明目標使用者及用途。"), section("market","市場發展潛力","標明市場資料的來源與日期。"),
         section("technology","產品及其製造技術","交代製造流程及技術條件。"), section("specs","規格與關鍵技術關聯性","對照技術與可驗證的規格。")]),
      section("implementation","實施方法與步驟","說明施作方式。",
        [section("techSource","技術來源","說明自研、採用或委託的技術。"), section("steps","詳細進行之步驟","逐步描述執行與驗收。"),
         section("security","資安導入詳細進行之步驟","說明資料保護與資安管控安排。"), section("coordination","廠商配合與分工","列出單位責任及場域配合。")]),
      section("milestones","預定實施進度及查核點","寫出階段、重點成果與佐證。",
        [section("timeline","實施進度","使用時程表或附上甘特圖。"), section("checkpoints","查核點說明","每一分項依範例每三個月至少安排一項查核點。")]),
      section("impact","預期成果及效益","說明雙方預期的成果與效益。",
        [section("quantitative","量化效益表","分列輔導方與受輔導方基準、目標、計算方法。"),
         section("qualitative","質化效益說明","說明示範、知識移轉與擴散。")]),
      section("resources","資源需求","請以新臺幣千元填寫金額。",
        [section("staffing","人力規劃","列出角色、分項、人月與薪資。"),
         section("budget","經費需求","列出政府補助及自籌金額。"),section("materials","材料清單","列明品名、廠牌、單價、數量。"),
         section("services","委託技術服務清單","列明廠商、服務與金額。")]),
      section("handover","擬移交受輔導單位之成果","填寫移交項目、交付日期及驗收方法。",
        [section("handoverStaff","執行與配合之人力、設備","說明雙方承接所需人力及設備。"),
         section("handoverCapacity","技術與承接能力","說明交付與承接能力、訓練、驗收或維護方式。")]),
      section("appendix","附件","列出基本資料表、相關證明與補充資料。"),
    ],
    tables:[
      table("history","政府計畫申請紀錄","history",[col("unit","申請單位",15),col("name","計畫名稱／類別",24),col("date","期間",16),col("subsidy","政府款（千元）",16,"number"),col("result","經費與效益／差異",29)],true),
      table("units","輔導雙方與聯絡資料","summary",[col("unit","單位／角色",21),col("name","名稱／姓名",22),col("details","統編、地址、聯絡資料或公司規模",57)],true),
      table("financials","主要產品與經營狀況","companyBackground",[col("unit","單位",15),col("product","產品項目",20),col("year","年度",12),col("volume","銷售量",15),col("revenue","銷售額（千元）",18,"number"),col("share","市占率（%）",20,"number")],true),
      table("comparison","競爭產品比較","companyBackground",[col("item","比較項目",22),col("own","受輔導廠商",26),col("domestic","國內廠商",26),col("foreign","國外廠商",26)],true),
      table("verification","分項功能與驗證方式","validation",[col("item","分項",18),col("spec","規格",25),col("method","驗證方法",31),col("criteria","通過基準",26)],true),
      table("workTimeline","實施進度表","timeline",[col("task","分項工作",27),col("period","執行月份",20),col("weight","權重（%）",16,"number"),col("effort","人月",12,"number"),col("result","預定成果",25)],true),
      table("checkpoints","查核點表","checkpoints",[col("id","編號",12),col("date","預定完成時間",19),col("criterion","查核內容與標準",37),col("evidence","佐證資料",32)],true),
      table("impact","量化效益表","quantitative",[col("unit","單位",15),col("metric","指標",22),col("base","基準與年度",20),col("target","目標與年度",20),col("method","算法／資料來源",23)],true),
      table("staffing","人力規劃表","staffing",[col("unit","單位",17),col("role","角色與分項",30),col("months","人月",15,"number"),col("cost","薪資（千元）",17,"number"),col("notes","備註",21)],true),
      table("budget","經費需求表（新臺幣千元）","budget",[col("item","經費科目",25),col("grant","政府補助",16,"number"),col("own","公司自籌",16,"number"),col("notes","說明",24)],true),
      table("materials","材料費清單（新臺幣千元）","materials",[col("item","品名",23),col("vendor","廠牌／公司",24),col("unit","單位",12),col("price","單價",18,"number"),col("quantity","數量",13,"number")],true),
      table("services","委託技術服務清單（新臺幣千元）","services",[col("item","服務項目",29),col("vendor","廠商",23),col("unit","單位",11),col("price","單價",16,"number"),col("quantity","數量",11,"number")],true),
      table("handoverStaff","執行與配合人力設備","handoverStaff",[col("unit","參與單位",22),col("staff","人力",23),col("expertise","專長",25),col("equipment","設備",30)],true),
      table("handover","交付及驗收表","handoverCapacity",[col("item","成果項目",22),col("detail","具體內容",26),col("quantity","數量",9),col("date","交付日期",17),col("acceptance","驗收方法",26)],true),
      table("attachments","附件清單","appendix",[col("id","附件編號",17),col("title","文件名稱",37),col("note","說明或存放位置",46)],true),
    ],
    numbering:"formal", contents:true, coverImage:false, bodyFont:"DFKai-SB", fontSize:12, margin:[66,66,66,66],
    note:"參照附件 2 保留十大章節與主要表格。封面橘色、目錄起編頁碼、正文與附件間保留分界。金額使用新臺幣千元。",
  },
];

export const templates = Object.fromEntries(catalog.map((template) => [template.key, template]));
export const templateList = catalog;
export const numerals = ["壹","貳","參","肆","伍","陸","柒","捌","玖","拾"];
export const smallNumerals = ["一","二","三","四","五","六","七","八","九","十"];
export const editableSections = (template) =>
  [...(template.front ?? []), ...template.sections.flatMap((chapter) => [chapter, ...chapter.children])];

export function sectionLabel(template, section, index) {
  if (template.numbering === "formal") return `${numerals[index]}、${section.title}`;
  return index === 0 || index === template.sections.length - 1
    ? section.title
    : `${smallNumerals[index - 1]}、${section.title}`;
}

export const sources = [
  ["期末專題計劃書面報告（範例）－電機專題（II）", "DOC · 3 頁", "封面與摘要後放入 7 個編號段落，再列參考文獻。封面有年度、題目、成員、指導老師與日期。"],
  ["Gloverse", "PDF · 21 頁", "專題組九章；有章節、圖目錄，附錄有分工與日誌。"],
  ["無人機 AI 智慧車禍辨識系統", "PDF · 26 頁", "專題組九章；圖表、時程與多層章節，結果與討論分列。"],
  ["智刀守護系統", "PDF · 25 頁", "專題組九章；條列目錄精簡，正文引用測試與設備圖表。"],
  ["木光記", "PDF · 27 頁", "專題組八章；圖目錄與表目錄分開，參考資料未獨立成章。"],
  ["人機介面自動化系統", "PDF · 41 頁", "專題組九章；分工、日誌、設計畫面及程式補充收在附錄。"],
  ["ATLAS 獵星者", "PDF · 20 頁", "創意組七章；封面、目錄與圖目錄，正文從創意動機開始。"],
  ["附件 2 輔導計畫書", "PDF · 23 頁", "封面、申請紀錄、摘要、目錄、十大章節及附件；設有時程、查核、經費、效益與移交等表格。"],
];
