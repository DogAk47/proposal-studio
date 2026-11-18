import { emptyDraft } from "./model.js";

export function exampleDraft(template) {
  const d = emptyDraft(template);
  if (template === "course") {
    Object.assign(d.fields, {
      institution:"國立範例大學 資訊工程學系", term:"115 學年度上學期 期末報告", title:"智慧校園用電監測系統",
      members:"S1150001 陳同學、S1150002 林同學", advisor:"王老師", date:"民國 115 年 12 月 28 日",
    });
    Object.assign(d.sections, {
      abstract:"本專題規劃開發校園用電監測原型，透過定時擷取感測資料與網頁圖表，協助使用者觀察教室的用電趨勢。系統將以安全的低壓模擬裝置驗證資料傳輸、紀錄及異常提示流程。",
      motivation:"教室離峰時段長時間開啟設備，容易因缺乏即時資訊而未被察覺。本組希望讓值班人員能快速辨識異常時段，作為調整設備使用習慣的依據。",
      problem:"## 使用情境\n值班人員可依時段檢查用電變化。原型以一間示範教室為範圍，驗證連續紀錄和門檻提醒的可行性。\n## 驗證目標\n在 30 分鐘測試期間內，資料接收率達 95% 以上，超過門檻後 10 秒內顯示提醒。",
      literature:"現有用電儀表通常提供瞬時讀值與累積用量。本專題聚焦於適合教室使用的時段摘要、資料中斷辨識與門檻提醒。",
      method:"## 系統架構\n感測端定時產生讀值，服務端記錄時間與數值，前端以折線圖呈現趨勢。\n## 測試設計\n設計正常、尖峰及資料中斷三種輸入情境，記錄實際反應時間並核對資料是否完整。",
      progress:"已完成資料欄位與畫面草圖。後續先完成資料傳輸，再用三種情境測試並整理結果。",
      division:"共用測試紀錄與版本管理。每位成員在每週會議交叉檢查其他成員的成果。",
      reflection:"目前已釐清驗證範圍，資料傳輸穩定度仍需實測。下一階段將完成原型並記錄不同取樣間隔的表現。",
      references:"交件前請將課程講義、感測器資料表與程式函式庫文件以實際使用的版本列出。",
    });
    d.tables.schedule = [
      {task:"需求與畫面規劃",start:"9 月",end:"10 月",owner:"全組",progress:"完成"},
      {task:"原型及資料傳輸",start:"10 月",end:"11 月",owner:"陳同學",progress:"進行中"},
      {task:"情境測試與報告",start:"11 月",end:"12 月",owner:"林同學",progress:"待進行"},
    ];
    d.tables.team = [
      {member:"陳同學",role:"資料擷取與傳輸",share:"50",evidence:"感測原型"},
      {member:"林同學",role:"網頁呈現與測試",share:"50",evidence:"監測介面"},
    ];
    return d;
  }
  if (template === "guidance") {
    Object.assign(d.fields,{program:"智慧製造技術應用輔導方案",title:"產線品質資料整合計畫",provider:"範例技術顧問有限公司",recipient:"範例精密製造有限公司",period:"民國 115 年 9 月至 116 年 2 月",date:"民國 115 年 8 月 15 日"});
    Object.assign(d.sections,{history:"輔導單位：無。\n受輔導單位：無。",summary:"於示範產線整合檢測資料與批次資訊，試行可追溯的異常通報流程。",
      companyBackground:"輔導單位負責資料整合與技術移轉。受輔導單位提供示範產線與品質資料。",
      background:"目前檢測結果由現場人員分批整理，彙總需要額外工時。",
      scenario:"目前以紙本及試算表分別紀錄。計畫完成後將自動關聯批次與檢測結果。",
      objectives:"以一條示範產線驗證資料追溯及異常通知，以試行前後的彙整工時評估效益。",
      architecture:"資料收集、批次對應、通知及權限管控四個工作分項。",
      security:"限制資料存取權限，定期檢查操作紀錄。",
      qualitative:"預計建立人員培訓教材，供後續產線擴充時使用。",market:"請換成實際引用的市場資料及調查日期。"});
    d.tables.budget = [{item:"系統整合與測試",grant:"120",own:"80",notes:"試行與驗證"},
      {item:"場域導入與培訓",grant:"70",own:"30",notes:"操作文件與教育訓練"}];
    d.tables.checkpoints = [{id:"A1",date:"115 年 11 月",criterion:"完成資料欄位及批次對應",evidence:"測試紀錄"},
      {id:"B1",date:"116 年 2 月",criterion:"完成試行與人員訓練",evidence:"驗收及訓練紀錄"}];
    d.tables.handover = [{item:"資料整合模組",detail:"對應規則、原始碼及操作說明",quantity:"1 套",date:"116 年 2 月",acceptance:"以既定資料重現測試結果"}];
    return d;
  }

  Object.assign(d.fields,{year:"115",category:"電機與電子群",title:"智慧校園用電監測系統",keywords:"用電監測、資料視覺化、異常提醒"});
  if (template === "contest-creative") {
    Object.assign(d.sections,{
      motivation:"教室的用電資訊不容易取得，本組希望讓值班人員能在巡查前找出值得留意的區域。",
      novelty:"以時段和教室兩種方式整理用電資料，在同一個畫面提示資料中斷及超過門檻。",
      design:"## 構想取捨\n先以低壓裝置及模擬資料開發，集中驗證資訊呈現與提醒流程。",
      principles:"由感測端、資料服務與瀏覽器介面組成。資料寫入時一併記錄時間及來源。",
      operation:"使用者選擇教室與時段，觀察用電曲線。如偵測到異常，進一步查看時間及原始數值。",
      production:"製作畫面原型後串接模擬訊號，依序檢查正常、尖峰與資料中斷情境。",
      appendix:"請補充實際分工、製作日誌及文獻資訊。",
    });
  } else {
    Object.assign(d.sections,{
      abstract:"本專題開發教室用電觀測原型，將定期讀值轉換為趨勢圖，並測試超過門檻時的提示流程。",
      motivation:"值班人員難以即時得知閒置教室是否仍在使用設備。本組希望透過時段資訊協助巡查。",
      curriculum:"## 程式設計實習\n實作用電資料整理與條件判斷。\n## 電子實習\n使用安全的低壓裝置驗證讀值流程。",
      method:"## 研究時程\n先定義資料格式，再完成模擬讀值、紀錄及介面。\n## 測試方法\n使用正常、尖峰、中斷三種情境核對系統輸出。",
      results:"示範階段已可呈現模擬用電趨勢。實測時須補上反應時間、資料接收率與測試條件。",
      discussion:"不同取樣頻率可能影響警示時間與紀錄量，後續以相同輸入比較設定差異。",
      conclusion:"原型已完成基本資料流程，可用於驗證提醒邏輯與圖表呈現。",
      references:"請列出實際使用的資料表、軟體文件與課程資料。",
      appendix:"補充各成員分工與開發紀錄。",
    });
  }
  d.tables.schedule = [{task:"資料格式與畫面原型",start:"9 月",end:"10 月",owner:"全組",progress:"完成"},
    {task:"資料串接與情境測試",start:"10 月",end:"12 月",owner:"全組",progress:"進行中"}];
  d.tables.team = [{member:"陳同學",role:"資料擷取與傳輸",share:"50",evidence:"感測原型"},{member:"林同學",role:"網頁呈現與測試",share:"50",evidence:"監測介面"}];
  return d;
}
