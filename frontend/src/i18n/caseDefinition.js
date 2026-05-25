export const t = {
  th: {
    // Page header
    pageTitle: 'กำหนดนิยามผู้ป่วย',
    pageSubtitle: 'สร้างกฎเกณฑ์เพื่อระบุผู้ป่วยในฐานข้อมูล',
    skipForNow: 'ข้ามไปก่อน →',

    // Left pane
    caseDefType: 'ประเภทนิยามผู้ป่วย',
    outputCol: 'คอลัมน์ผลลัพธ์',
    suspected: 'Suspected (สงสัย)',
    probable: 'Probable (น่าจะเป็น)',
    confirmed: 'Confirmed (ยืนยัน)',

    // Buttons
    refreshPreview: 'รีเฟรชตัวอย่าง',
    calculating: 'กำลังคำนวณ…',
    applyDef: 'ใช้นิยามผู้ป่วย',
    applying: 'กำลังใช้…',
    calcPreview: 'กำลังคำนวณตัวอย่าง…',
    proceedToAnalysis: 'ดำเนินการวิเคราะห์ →',

    // Apply result
    defApplied: 'ใช้นิยามผู้ป่วยสำเร็จ',
    defAppliedDesc: (col) => `ประเมินและเพิ่มคอลัมน์ "${col}" ลงในชุดข้อมูลแล้ว`,
    cases: 'ผู้ป่วย',
    nonCases: 'ไม่ใช่ผู้ป่วย',
    unknown: 'ไม่ทราบ',

    // Errors
    loadingCols: 'กำลังโหลดคอลัมน์…',
    error: 'ข้อผิดพลาด',
    skipToProject: 'ข้ามไปที่โครงการ →',

    // CriteriaCards — Time
    enableTime: 'เปิดใช้งานเกณฑ์เวลา',
    dateCol: 'คอลัมน์วันที่',
    operator: 'ตัวดำเนินการ',
    startDate: 'วันที่เริ่มต้น',
    endDate: 'วันที่สิ้นสุด',
    date: 'วันที่',
    selectPlaceholder: '— เลือก —',
    columnPlaceholder: '— คอลัมน์ —',

    // CriteriaCards — Place
    enablePlace: 'เปิดใช้งานเกณฑ์สถานที่',
    column: 'คอลัมน์',
    value: 'ค่า',
    valuesCommaSep: 'ค่า (คั่นด้วยลูกน้ำ)',
    addPlaceRule: '+ เพิ่มกฎสถานที่',

    // CriteriaCards — Clinical
    clinicalTitle: 'เกณฑ์ทางคลินิกและห้องปฏิบัติการ',
    ruleType: 'ประเภทกฎ',
    anySymptoms: 'อาการใดก็ได้ที่เลือก',
    allSymptoms: 'อาการทั้งหมดที่เลือก',
    nOfMSymptoms: 'N จาก M อาการที่เลือก',
    minRequired: 'จำนวนขั้นต่ำ',
    symptoms: 'อาการ',
    addSympRule: '+ เพิ่มกฎอาการ',
    numericRuleTitle: 'กฎอาการเชิงตัวเลข',
    labRuleTitle: 'กฎห้องปฏิบัติการ',
    addNumericRule: '+ เพิ่มกฎตัวเลข',
    addLabRule: '+ เพิ่มเกณฑ์ห้องปฏิบัติการ',
    bothOptional: '— ทั้งคู่ไม่บังคับ',

    // PreviewComponents
    generatedDef: 'นิยามผู้ป่วยที่สร้างขึ้น',
    warnings: 'คำเตือน',
    previewResult: 'ผลการแสดงตัวอย่าง',
    meetsCriteria: 'ผ่านเกณฑ์',
    doesNotMeet: 'ไม่ผ่านเกณฑ์',
    recordId: 'รหัสบันทึก',
    status: 'สถานะ',
    reason: 'เหตุผล',

    // Lang toggle
    langLabel: 'TH',
  },
  en: {
    pageTitle: 'Define Case Definition',
    pageSubtitle: 'Build rules to identify cases in your line list.',
    skipForNow: 'Skip for now →',

    caseDefType: 'Case definition type',
    outputCol: 'Output column',
    suspected: 'Suspected',
    probable: 'Probable',
    confirmed: 'Confirmed',

    refreshPreview: 'Refresh Preview',
    calculating: 'Calculating…',
    applyDef: 'Apply Case Definition',
    applying: 'Applying...',
    calcPreview: 'Calculating preview…',
    proceedToAnalysis: 'Proceed to Analysis →',

    defApplied: 'Case Definition Applied',
    defAppliedDesc: (col) => `Successfully evaluated and added "${col}" to your dataset.`,
    cases: 'Cases',
    nonCases: 'Non-cases',
    unknown: 'Unknown',

    loadingCols: 'Loading columns…',
    error: 'Error',
    skipToProject: 'Skip to project →',

    enableTime: 'Enable time criteria',
    dateCol: 'Date column',
    operator: 'Operator',
    startDate: 'Start date',
    endDate: 'End date',
    date: 'Date',
    selectPlaceholder: '— Select —',
    columnPlaceholder: '— Column —',

    enablePlace: 'Enable place criteria',
    column: 'Column',
    value: 'Value',
    valuesCommaSep: 'Values (comma separated)',
    addPlaceRule: '+ Add place rule',

    clinicalTitle: 'Clinical & Laboratory Criteria',
    ruleType: 'Rule type',
    anySymptoms: 'ANY of selected symptoms',
    allSymptoms: 'ALL of selected symptoms',
    nOfMSymptoms: 'N of M selected symptoms',
    minRequired: 'Min. required',
    symptoms: 'Symptoms',
    addSympRule: '+ Add symptom rule',
    numericRuleTitle: 'Numeric Symptom Rule',
    labRuleTitle: 'Laboratory Rule',
    addNumericRule: '+ Add numeric rule',
    addLabRule: '+ Add lab criteria',
    bothOptional: '— both optional',

    generatedDef: 'Generated Case Definition',
    warnings: 'Warnings',
    previewResult: 'Preview Result',
    meetsCriteria: 'Meets criteria',
    doesNotMeet: 'Does not meet',
    recordId: 'Record ID',
    status: 'Status',
    reason: 'Reason',

    langLabel: 'EN',
  },
}
