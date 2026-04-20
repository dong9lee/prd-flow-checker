"use client";
import { useState, useEffect, useRef } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import {
  Search, RotateCcw, Sparkles, AlertTriangle, ShieldAlert,
  Lightbulb, BrainCircuit, Bot, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChecklistItem = {
  id: string;
  criterion: string;
  met: boolean;
};

type ChecklistSection = {
  items: ChecklistItem[];
};

type ReviewResult = {
  problem_score: number;
  hypothesis_score: number;
  kpi_score: number;
  feature_score: number;
  structural_depth_score: number;
  checklist?: {
    problem: ChecklistSection;
    hypothesis: ChecklistSection;
    kpi: ChecklistSection;
    feature: ChecklistSection;
    structural: ChecklistSection;
  };
  segment_defined: boolean;
  root_cause_missing: boolean;
  vanity_metric_detected: boolean;
  critical_breakpoint: string;
  summary: string;
  hidden_risk: string;
  improvements: string[];
  questions: string[];
  ai_suspicion_score: number;
  ai_suspicion_reason: string;
  feedback_reflected: boolean | null;
  feedback_comment: string;
};

type Sections = {
  problem: string;
  segment: string;
  hypothesis: string;
  kpi: string;
  feature: string;
  experiment: string;
  timeline: string;
};

type HistoryEntry = {
  version: number;
  score: number;
  result: ReviewResult;
};

type Project = {
  id: string;
  title: string;
  sections: Sections;
  history: HistoryEntry[];
  updatedAt: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_SECTION_KEYS = ["problem", "segment", "hypothesis", "kpi", "feature"] as const;

const SECTION_META = [
  { key: "problem",     label: "문제 정의",      optional: false, placeholder: "사용자가 겪는 문제의 근본 원인은 무엇인가요?\n(증상이 아닌 원인 수준으로 작성하세요)" },
  { key: "segment",    label: "사용자 세그먼트",  optional: false, placeholder: "이 문제를 가장 크게 겪는 구체적인 사용자 그룹은 누구인가요?" },
  { key: "hypothesis", label: "가설",            optional: false, placeholder: "이 기능을 제공하면 사용자의 어떤 행동이 어떻게 변화할 것이라고 예상하나요?" },
  { key: "kpi",        label: "KPI",             optional: false, placeholder: "가설이 맞다면 어떤 지표가 어느 방향으로 얼마나 변화할 것으로 예상하나요?" },
  { key: "feature",    label: "기능",             optional: false, placeholder: "문제 원인을 제거하기 위한 구체적인 기능과 그 메커니즘을 설명하세요." },
  { key: "experiment", label: "실험 설계",        optional: true,  placeholder: "A/B 테스트 설계, 실험군/대조군 구성, 샘플 사이즈 등을 설명하세요." },
  { key: "timeline",   label: "기간",             optional: true,  placeholder: "개발 일정, 실험 기간, 단계별 마일스톤을 입력하세요." },
] as const;

const EMPTY_SECTIONS: Sections = {
  problem: "", segment: "", hypothesis: "", kpi: "", feature: "", experiment: "", timeline: "",
};

const LS_PROJECTS = "prd-checker-projects";
const LS_CURRENT  = "prd-checker-current-id";

const EXAMPLE_PRDS = [
  {
    domain: "커머스",
    sections: {
      problem: "모바일 앱 구매 전환율이 웹 대비 40% 낮다. 원인 분석 결과, 결제 단계에서 이탈률이 68%로 집중되었으며 이는 복잡한 주소/결제 입력 흐름이 주요 원인으로 확인되었다.",
      segment: "월 1회 이상 앱을 통해 구매를 시도하지만 결제 완료 전 이탈하는 2030 여성 사용자. 특히 신규 가입 후 첫 구매를 시도하는 사용자의 이탈률이 평균의 2.3배.",
      hypothesis: "원클릭 결제(배송지·결제수단 자동완성)를 제공하면, 결제 단계 소요 시간이 줄어들어 이탈 없이 구매를 완료하는 사용자 비율이 증가할 것이다.",
      kpi: "선행지표: 결제 단계 평균 소요시간 (현재 2분 40초 → 목표 40초 이하). 실험지표: 결제 단계 이탈률 (현재 68% → 목표 40% 이하). 가드레일: 결제 오류율 1% 미만 유지.",
      feature: "간편결제 온보딩: 첫 구매 완료 시 배송지·결제수단 저장 동의 유도. 원클릭 결제 버튼: 저장된 정보로 단일 탭 구매 완료. 결제 수단 우선순위 학습: 자주 쓰는 수단을 상단 노출.",
      experiment: "", timeline: "",
    },
  },
  {
    domain: "SaaS",
    sections: {
      problem: "B2B SaaS 제품의 신규 팀 온보딩 완료율이 23%에 불과하다. 분석 결과 가입 후 7일 내 핵심 기능(협업 워크스페이스 생성)을 사용하지 않은 팀은 90% 이상 이탈한다.",
      segment: "5인 이하 소규모 팀을 이끄는 팀 리더로, SaaS 도구 경험이 적고 IT 지원 인력이 없는 비개발 직군. 주로 마케팅·디자인·기획 팀장.",
      hypothesis: "온보딩 첫 화면에서 팀의 실제 업무 맥락(팀 유형, 주요 업무)을 입력받아 맞춤형 워크스페이스 템플릿을 자동 생성하면, 7일 내 핵심 기능 사용률이 높아져 30일 유지율이 향상될 것이다.",
      kpi: "선행지표: 온보딩 완료율 (23% → 60%). 실험지표: 7일 내 워크스페이스 생성 비율 (현재 18% → 50%). 가드레일: 온보딩 소요 시간 5분 초과 팀 비율 20% 이하.",
      feature: "팀 프로파일링 단계: 팀 유형·규모·주요 업무 선택 (3단계, 각 30초 이내). 템플릿 자동 추천: 프로파일 기반 워크스페이스 구조 생성 및 샘플 데이터 삽입. 진행 상황 체크리스트: 온보딩 완료까지 남은 단계 상시 표시.",
      experiment: "", timeline: "",
    },
  },
  {
    domain: "헬스케어",
    sections: {
      problem: "만성질환 관리 앱의 복약 알림 수신 후 실제 복약 기록률이 31%에 불과하다. 인터뷰 결과, 알림이 와도 '나중에 하려다' 잊어버리는 패턴이 원인이며 알림과 실행 사이의 마찰이 핵심.",
      segment: "고혈압·당뇨 등 만성질환으로 매일 복약이 필요한 60대 이상 사용자. 스마트폰 사용 숙련도가 낮고, 약 챙기는 것을 자주 잊는다고 응답한 사용자 (전체의 67%).",
      hypothesis: "복약 알림에서 단일 탭으로 복약 기록까지 완료할 수 있는 액션을 제공하면, 알림과 행동 사이의 단계가 줄어들어 실제 복약 기록률이 높아질 것이다.",
      kpi: "선행지표: 알림 수신 후 30초 내 앱 진입율 (현재 12% → 40%). 실험지표: 복약 기록 완료율 (31% → 60%). 가드레일: 알림 수신 거부율 현 수준(8%) 유지.",
      feature: "잠금화면 위젯: 알림에서 바로 복약 완료 버튼 표시 (앱 진입 불필요). 복약 완료 햅틱 피드백: 기록 완료 시 진동으로 확인. 주간 복약 달력: 연속 기록 시각화로 지속 동기 부여.",
      experiment: "", timeline: "",
    },
  },
] satisfies { domain: string; sections: Sections }[];

const newProject = (): Project => ({
  id: crypto.randomUUID(),
  title: "새 PRD",
  sections: { ...EMPTY_SECTIONS },
  history: [],
  updatedAt: Date.now(),
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const gc  = "relative rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]";
const gb  = "absolute inset-0 rounded-2xl backdrop-blur-[40px]";
const gg  = "absolute inset-0 rounded-2xl bg-gradient-to-br from-white/50 via-white/20 to-transparent";
const gbr = "absolute inset-0 rounded-2xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";

const btnBase = `flex items-center gap-2 px-5 py-2 rounded-full
  bg-white/10 backdrop-blur-xl border border-white/30 text-slate-700 text-sm
  shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:bg-white/20 hover:scale-105
  active:scale-95 transition-all duration-200 disabled:opacity-50`;

// ─── Components ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${gc} print-card ${className}`}>
      <div className={gb} />
      <div className={gg} />
      <div className={gbr} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [currentId, setCurrentId]   = useState<string>("");
  const [aiResult, setAiResult]     = useState<ReviewResult | null>(null);
  const [prevFeedback, setPrevFeedback] = useState<string[] | null>(null);
  const [improvedPrd, setImprovedPrd]   = useState<string | null>(null);
  const [improving, setImproving]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState("");
  const [copied, setCopied]         = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [targetScore, setTargetScore]   = useState<number>(8);
  const [compareA, setCompareA]         = useState<number>(0);
  const [compareB, setCompareB]         = useState<number>(1);
  const [compareMode, setCompareMode]   = useState(false);
  const analysisCache        = useRef<Map<string, ReviewResult>>(new Map());
  const lastAnalyzedText     = useRef<string>("");
  const [fromCache, setFromCache] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    const saved = localStorage.getItem(LS_PROJECTS);
    const savedId = localStorage.getItem(LS_CURRENT);
    if (saved) {
      const parsed: Project[] = JSON.parse(saved);
      setProjects(parsed);
      setCurrentId(savedId && parsed.find(p => p.id === savedId) ? savedId : parsed[0]?.id ?? "");
    } else {
      const initial = newProject();
      setProjects([initial]);
      setCurrentId(initial.id);
    }
  }, []);

  // ── 저장 ──
  useEffect(() => {
    if (projects.length === 0) return;
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
    localStorage.setItem(LS_CURRENT, currentId);
  }, [projects, currentId]);

  // ── 드롭다운 외부 클릭 닫기 ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjects(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── 현재 프로젝트 ──
  const current = projects.find(p => p.id === currentId);
  const sections = current?.sections ?? EMPTY_SECTIONS;
  const history  = current?.history  ?? [];

  const updateCurrent = (patch: Partial<Project>) => {
    setProjects(prev =>
      prev.map(p => p.id === currentId ? { ...p, ...patch, updatedAt: Date.now() } : p)
    );
  };

  const setSections = (fn: (s: Sections) => Sections) => {
    updateCurrent({ sections: fn(sections) });
  };

  // ── 프로젝트 관리 ──
  const createProject = () => {
    const p = newProject();
    setProjects(prev => [p, ...prev]);
    setCurrentId(p.id);
    setAiResult(null);
    setPrevFeedback(null);
    setImprovedPrd(null);
    setShowProjects(false);
  };

  const switchProject = (id: string) => {
    setCurrentId(id);
    setAiResult(null);
    setPrevFeedback(null);
    setImprovedPrd(null);
    setShowProjects(false);
  };

  const deleteProject = (id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) {
        const fresh = newProject();
        setCurrentId(fresh.id);
        return [fresh];
      }
      if (id === currentId) setCurrentId(next[0].id);
      return next;
    });
  };

  // ── 분석 ──
  const prdText = SECTION_META
    .filter(({ key, optional }) => !optional || (sections[key as keyof Sections] ?? "").trim().length > 0)
    .map(({ key, label }) => `[${label}]\n${sections[key as keyof Sections]}`)
    .join("\n\n");

  const runAnalysis = async (feedback?: string[], force = false) => {
    const cacheKey = `${prdText}|||${feedback?.join("|") ?? ""}`;

    if (!force && analysisCache.current.has(cacheKey)) {
      const cached = analysisCache.current.get(cacheKey)!;
      setAiResult(cached);
      setPrevFeedback(cached.improvements ?? null);
      setFromCache(true);
      return;
    }

    try {
      setFromCache(false);
      setLoading(true);
      setAiResult(null);
      setImprovedPrd(null);
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prd: prdText,
          feedback: feedback ? feedback.join("\n") : undefined,
        }),
      });
      const data: ReviewResult = await res.json();
      analysisCache.current.set(cacheKey, data);
      setPrevFeedback(data.improvements ?? null);
      setAiResult(data);
      const score = Math.round(
        (data.problem_score + data.hypothesis_score + data.kpi_score +
          data.feature_score + data.structural_depth_score) / 5
      );
      const contentChanged = prdText !== lastAnalyzedText.current;
      lastAnalyzedText.current = prdText;
      if (contentChanged || history.length === 0) {
        const entry: HistoryEntry = { version: history.length + 1, score, result: data };
        updateCurrent({ history: [...history, entry] });
      } else {
        // 내용 변경 없음 → 기존 마지막 버전 결과 업데이트
        const updated = [...history];
        updated[updated.length - 1] = { ...updated[updated.length - 1], score, result: data };
        updateCurrent({ history: updated });
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  const handleCheck        = () => runAnalysis();
  const handleForceCheck   = () => runAnalysis(undefined, true);
  const handleRecheck      = () => runAnalysis(prevFeedback ?? undefined);

  const handleImprove = async () => {
    if (!aiResult?.improvements?.length) return;
    try {
      setImproving(true);
      setImprovedPrd(null);
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prd: prdText, improvements: aiResult.improvements }),
      });
      const data = await res.json();
      if (data.improved_prd) setImprovedPrd(data.improved_prd);
    } catch {
      //
    } finally {
      setImproving(false);
    }
  };

  const applyImprovedPrd = () => {
    if (!improvedPrd) return;
    const parsed: Partial<Sections> = {};
    for (const { key, label } of SECTION_META) {
      const regex = new RegExp(`\\[${label}\\]\\s*([\\s\\S]*?)(?=\\[|$)`);
      const match = improvedPrd.match(regex);
      if (match) parsed[key as keyof Sections] = match[1].trim();
    }
    if (Object.keys(parsed).length > 0)
      updateCurrent({ sections: { ...sections, ...parsed } });
  };

  // ── 단축키 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) runAnalysis();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, prdText]);

  // ── 로딩 단계 ──
  useEffect(() => {
    if (loading) {
      setStep("문제 구조 분석 중...");
      const t1 = setTimeout(() => setStep("가설 검증 중..."), 1000);
      const t2 = setTimeout(() => setStep("KPI 점검 중..."), 2000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [loading]);

  // ── 점수 계산 ──
  const totalScore = aiResult
    ? Math.round(
        (aiResult.problem_score + aiResult.hypothesis_score + aiResult.kpi_score +
          aiResult.feature_score + aiResult.structural_depth_score) / 5
      )
    : null;

  const radarData = aiResult ? [
    { axis: "문제 정의", value: aiResult.problem_score,          target: targetScore },
    { axis: "가설",      value: aiResult.hypothesis_score,       target: targetScore },
    { axis: "KPI",       value: aiResult.kpi_score,              target: targetScore },
    { axis: "기능",      value: aiResult.feature_score,          target: targetScore },
    { axis: "구조 깊이", value: aiResult.structural_depth_score, target: targetScore },
  ] : [];

  // 버전 비교용
  const makeRadarData = (h: HistoryEntry) => [
    { axis: "문제 정의", value: h.result.problem_score },
    { axis: "가설",      value: h.result.hypothesis_score },
    { axis: "KPI",       value: h.result.kpi_score },
    { axis: "기능",      value: h.result.feature_score },
    { axis: "구조 깊이", value: h.result.structural_depth_score },
  ];

  const scoreRows = aiResult ? [
    { label: "문제 정의", value: aiResult.problem_score,          items: aiResult.checklist?.problem?.items },
    { label: "가설",      value: aiResult.hypothesis_score,       items: aiResult.checklist?.hypothesis?.items },
    { label: "KPI",       value: aiResult.kpi_score,              items: aiResult.checklist?.kpi?.items },
    { label: "기능",      value: aiResult.feature_score,          items: aiResult.checklist?.feature?.items },
    { label: "구조 깊이", value: aiResult.structural_depth_score, items: aiResult.checklist?.structural?.items },
  ] : [];

  // ── 복사 ──
  const handleCopy = () => {
    if (!aiResult || totalScore === null) return;
    const lines = [
      `[${current?.title ?? "PRD"}] 분석 결과 (v${history.length})`,
      `총점: ${totalScore}/10`,
      ``,
      `문제 정의: ${aiResult.problem_score} | 가설: ${aiResult.hypothesis_score} | KPI: ${aiResult.kpi_score} | 기능: ${aiResult.feature_score} | 구조 깊이: ${aiResult.structural_depth_score}`,
      ``,
      `[총평] ${aiResult.summary}`,
      `[핵심 단절] ${aiResult.critical_breakpoint}`,
      `[잠재 리스크] ${aiResult.hidden_risk}`,
      ``,
      `[개선 제안]`,
      ...(aiResult.improvements?.map((v, i) => `${i + 1}. ${v}`) ?? []),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filledCount = REQUIRED_SECTION_KEYS.filter(k => sections[k].trim().length > 0).length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-8">
      <div className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] bg-blue-300 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-purple-300 rounded-full blur-3xl opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-200 rounded-full blur-3xl opacity-20" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-medium text-slate-800">PRD Flow Checker</h1>
            <p className="text-slate-500 text-xs mt-0.5">답을 알려주지 않습니다. 스스로 생각하게 만듭니다.</p>
          </div>

          {/* 프로젝트 선택기 */}
          <div className="relative print-hidden" ref={dropdownRef}>
            <button
              onClick={() => setShowProjects(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-full
                bg-white/20 backdrop-blur-xl border border-white/40
                text-slate-700 text-sm hover:bg-white/30 transition-all"
            >
              <span className="max-w-36 truncate">{current?.title ?? "프로젝트"}</span>
              <span className="text-slate-400 text-xs">{showProjects ? "▲" : "▼"}</span>
            </button>

            {showProjects && (
              <div className="absolute right-0 top-12 w-64 z-50 rounded-2xl overflow-hidden
                border border-white/50 backdrop-blur-xl bg-white/70 shadow-xl">
                <div className="p-2">
                  {projects.map(p => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer
                        ${p.id === currentId ? "bg-slate-700 text-white" : "hover:bg-white/60 text-slate-700"}`}
                    >
                      <span
                        className="text-sm truncate flex-1"
                        onClick={() => switchProject(p.id)}
                      >
                        {p.title}
                      </span>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                          className={`ml-2 text-xs px-1.5 rounded hover:opacity-70 ${p.id === currentId ? "text-white/70" : "text-slate-400"}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/40 p-2">
                  <button
                    onClick={createProject}
                    className="w-full text-sm text-slate-600 px-3 py-2 rounded-xl hover:bg-white/60 text-left"
                  >
                    + 새 PRD
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2컬럼 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* 왼쪽: 입력 */}
          <div className="space-y-4 lg:sticky lg:top-8 print-hidden">

            {/* PRD 제목 + 예시 불러오기 */}
            <div className="flex items-center gap-3">
              <input
                value={current?.title ?? ""}
                onChange={e => updateCurrent({ title: e.target.value })}
                className="flex-1 bg-transparent outline-none text-lg font-medium text-slate-700
                  border-b border-white/30 pb-1 focus:border-slate-400 transition-colors"
                placeholder="PRD 제목을 입력하세요"
              />
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowExamples(v => !v)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/40
                    bg-white/20 text-slate-600 hover:bg-white/30 transition-all whitespace-nowrap"
                >
                  예시 불러오기
                </button>
                {showExamples && (
                  <div className="absolute right-0 top-9 w-44 z-50 rounded-xl overflow-hidden
                    border border-white/50 backdrop-blur-xl bg-white/80 shadow-xl">
                    {EXAMPLE_PRDS.map(ex => (
                      <button
                        key={ex.domain}
                        onClick={() => {
                          const p = newProject();
                          p.title = `예시 PRD (${ex.domain})`;
                          p.sections = { ...ex.sections };
                          setProjects(prev => [p, ...prev]);
                          setCurrentId(p.id);
                          setAiResult(null);
                          setPrevFeedback(null);
                          setImprovedPrd(null);
                          setShowExamples(false);
                        }}
                        className="w-full text-left text-sm text-slate-700 px-4 py-2.5
                          hover:bg-white/60 transition-all"
                      >
                        {ex.domain}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 섹션 완성도 인디케이터 */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-500">
                {filledCount === REQUIRED_SECTION_KEYS.length ? "필수 섹션 완성 ✓" : `${filledCount} / ${REQUIRED_SECTION_KEYS.length} 필수 섹션 작성됨`}
              </span>
              <div className="flex gap-1.5">
                {SECTION_META.filter(s => !s.optional).map(({ key, label }) => (
                  <div
                    key={key}
                    title={label}
                    className={`w-6 h-1.5 rounded-full transition-all duration-300 ${
                      (sections[key as keyof Sections] ?? "").trim() ? "bg-slate-600" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 구조화 입력 */}
            <GlassCard>
              <div className="divide-y divide-white/30">
                {SECTION_META.map(({ key, label, placeholder, optional }) => (
                  <div key={key} className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-sm font-semibold text-slate-600">{label}</label>
                      {optional && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/40 text-slate-400 border border-white/30">
                          선택
                        </span>
                      )}
                    </div>
                    <textarea
                      value={sections[key as keyof Sections] ?? ""}
                      onChange={e => setSections(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={3}
                      className="w-full bg-transparent outline-none text-sm text-slate-700 resize-none leading-relaxed"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* 분석하기 — 메인 CTA */}
            <button
              onClick={handleCheck}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                bg-slate-800 hover:bg-slate-700 active:scale-[0.98]
                text-white text-sm font-medium
                shadow-[0_4px_24px_rgba(0,0,0,0.15)]
                transition-all duration-200 disabled:opacity-50"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />{step}</>
                : <><Search size={15} />PRD 분석하기</>
              }
            </button>

            {/* 보조 버튼 */}
            {!loading && (prevFeedback || fromCache) && (
              <div className="flex gap-2">
                {prevFeedback && (
                  <button onClick={handleRecheck} className={`${btnBase} flex-1 justify-center`}>
                    <RotateCcw size={13} />피드백 반영 재분석
                  </button>
                )}
                {fromCache && (
                  <button onClick={handleForceCheck} className={`${btnBase} flex-1 justify-center`}>
                    <RotateCcw size={13} />새로 분석
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽: 결과 */}
          <div className="space-y-4 print-full">

            {/* 히스토리 스트립 + PDF */}
            {history.length > 0 && (
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">점수 변화</span>
                  {history.map((h, i) => (
                    <div key={h.version} className="flex items-center gap-1">
                      <span className={`text-xs px-2.5 py-1 rounded-full border backdrop-blur-sm
                        ${h.version === history.length
                          ? "bg-slate-700/80 text-white border-slate-600"
                          : "bg-white/30 text-slate-500 border-white/40"}`}>
                        v{h.version} · {h.score}점
                      </span>
                      {i < history.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 버전 비교 모드 */}
            {history.length >= 2 && (
              <div className="flex items-center gap-2 print-hidden">
                <button
                  onClick={() => setCompareMode(v => !v)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    compareMode
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white/20 text-slate-500 border-white/40 hover:bg-white/30"
                  }`}
                >
                  버전 비교
                </button>
                {compareMode && (
                  <>
                    <select
                      value={compareA}
                      onChange={e => setCompareA(Number(e.target.value))}
                      className="text-xs px-2 py-1 rounded-lg bg-white/30 border border-white/40 text-slate-600 outline-none"
                    >
                      {history.map((h, i) => i !== compareB && (
                        <option key={h.version} value={i}>v{h.version} · {h.score}점</option>
                      ))}
                    </select>
                    <span className="text-slate-400 text-xs">vs</span>
                    <select
                      value={compareB}
                      onChange={e => setCompareB(Number(e.target.value))}
                      className="text-xs px-2 py-1 rounded-lg bg-white/30 border border-white/40 text-slate-600 outline-none"
                    >
                      {history.map((h, i) => i !== compareA && (
                        <option key={h.version} value={i}>v{h.version} · {h.score}점</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}

            {compareMode && history[compareA] && history[compareB] && (
              <GlassCard>
                <div className="p-5">
                  <h2 className="text-sm font-medium text-slate-300 mb-4">
                    v{history[compareA].version} vs v{history[compareB].version} 비교
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[history[compareA], history[compareB]].map((h, col) => (
                      <div key={col}>
                        <div className="text-center mb-3">
                          <span className="text-2xl font-medium text-slate-700">{h.score}</span>
                          <span className="text-xs text-slate-400 ml-1">점 · v{h.version}</span>
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                          <RadarChart data={makeRadarData(h)}>
                            <PolarGrid stroke="rgba(100,116,139,0.2)" />
                            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                            <Radar
                              dataKey="value"
                              stroke="#475569"
                              fill="#475569"
                              fillOpacity={0.25}
                              dot={{ r: 2, fill: "#475569" }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                        <div className="space-y-1 mt-2">
                          {[
                            { label: "문제", value: h.result.problem_score },
                            { label: "가설", value: h.result.hypothesis_score },
                            { label: "KPI",  value: h.result.kpi_score },
                            { label: "기능", value: h.result.feature_score },
                            { label: "구조", value: h.result.structural_depth_score },
                          ].map(({ label, value }) => {
                            const other = col === 0 ? history[compareB] : history[compareA];
                            const otherVal = {
                              "문제": other.result.problem_score,
                              "가설": other.result.hypothesis_score,
                              "KPI":  other.result.kpi_score,
                              "기능": other.result.feature_score,
                              "구조": other.result.structural_depth_score,
                            }[label] ?? value;
                            const diff = value - otherVal;
                            return (
                              <div key={label} className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">{label}</span>
                                <span className="flex items-center gap-1">
                                  <span className="text-slate-700 font-medium">{value}</span>
                                  {diff !== 0 && (
                                    <span className={diff > 0 ? "text-green-600" : "text-red-500"}>
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            )}

            {!aiResult && !loading && (
              <div className="space-y-4">

                {/* 이 도구는 */}
                <GlassCard>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">이 도구는</p>
                    <div className="space-y-3">
                      {[
                        { icon: "→", text: "답을 주지 않습니다. PRD의 논리 구조를 스스로 점검하게 만듭니다." },
                        { icon: "→", text: "점수와 함께 \"왜 그런가요?\" 질문을 돌려줍니다. 생각을 멈추지 않게 하기 위해서입니다." },
                        { icon: "→", text: "문제→가설→기능→KPI 흐름에서 단절을 찾아냅니다. ChatGPT에게 물어봐도 나오지 않는 부분입니다." },
                      ].map(({ icon, text }, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-slate-300 shrink-0 text-xs mt-0.5">{icon}</span>
                          <span className="text-xs text-slate-500 leading-relaxed">{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* 평가 기준 */}
                <GlassCard>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">평가 기준</p>
                    <div className="space-y-3">
                      {[
                        { label: "문제 정의", desc: "증상이 아닌 근본 원인을 특정했는가" },
                        { label: "사용자 세그먼트", desc: "문제를 겪는 대상이 구체적으로 정의됐는가" },
                        { label: "가설", desc: "기능이 사용자 행동 변화를 유발하는지 설명하는가" },
                        { label: "KPI", desc: "가설을 검증할 수 있는 선행지표인가" },
                        { label: "기능", desc: "문제 원인을 제거하는 메커니즘을 담고 있는가" },
                      ].map(({ label, desc }) => (
                        <div key={label} className="flex gap-3">
                          <span className="text-xs font-medium text-slate-600 w-24 shrink-0 pt-0.5">{label}</span>
                          <span className="text-xs text-slate-400 leading-relaxed">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* 점수 구간 */}
                <GlassCard>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">점수 구간</p>
                    <div className="space-y-2.5">
                      {[
                        { range: "8 – 10", label: "구조적으로 완성된 PRD", color: "bg-green-400" },
                        { range: "5 – 7",  label: "방향은 맞지만 논리 단절 있음", color: "bg-yellow-400" },
                        { range: "0 – 4",  label: "문제 정의 또는 가설 재작성 필요", color: "bg-red-400" },
                      ].map(({ range, label, color }) => (
                        <div key={range} className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
                          <span className="text-xs font-medium text-slate-600 w-12 shrink-0">{range}점</span>
                          <span className="text-xs text-slate-400">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* 작성 전 체크리스트 */}
                <GlassCard>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">분석 전 자가 점검</p>
                    <ul className="space-y-2">
                      {[
                        "문제를 '기능이 없어서'가 아닌 '사용자가 ~을 못 해서'로 표현했나요?",
                        "이 기능이 없어도 사용자가 대안을 찾고 있나요?",
                        "KPI가 오르면 가설이 맞다고 단언할 수 있나요?",
                        "실패했을 때 무엇을 배울 수 있는지 알고 있나요?",
                      ].map((q, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                          <span className="text-slate-300 shrink-0">{i + 1}.</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>

              </div>
            )}

            {aiResult && (
              <>
                {/* 루프 단계 인디케이터 */}
                <div className="flex items-center gap-2 px-1 print-hidden">
                  {[
                    { n: 1, label: "분석 완료" },
                    { n: 2, label: "질문 검토" },
                    { n: 3, label: "PRD 수정" },
                    { n: 4, label: "재분석" },
                  ].map(({ n, label }, i, arr) => {
                    const done = history.length >= n;
                    const active = history.length + 1 === n || (n === 2 && history.length === 1);
                    return (
                      <div key={n} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-all
                            ${done ? "bg-slate-700 text-white" : active ? "bg-white/60 border border-slate-400 text-slate-500" : "bg-white/20 border border-white/30 text-slate-300"}`}>
                            {done ? <Check size={10} /> : n}
                          </div>
                          <span className={`text-xs ${done ? "text-slate-600" : active ? "text-slate-500" : "text-slate-300"}`}>{label}</span>
                        </div>
                        {i < arr.length - 1 && <span className="text-slate-200 text-xs">—</span>}
                      </div>
                    );
                  })}
                </div>

                {/* 총점 + 레이더 */}
                <GlassCard>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-end gap-3">
                        <div className="text-5xl font-medium text-slate-800">{totalScore}</div>
                        <div className="flex flex-col gap-0.5 mb-1">
                          <div className="text-xs text-slate-400">PRD 완성도</div>
                          {fromCache && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/40 border border-white/50 text-slate-400">
                              이전 분석 결과
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleCopy}
                        className="print-hidden text-xs px-3 py-1 rounded-full border border-white/40 bg-white/20 text-slate-600 hover:bg-white/30 transition-all"
                      >
                        {copied ? <><Check size={12} />복사됨</> : "결과 복사"}
                      </button>
                    </div>

                    <div className="flex gap-2 flex-wrap mb-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${aiResult.segment_defined ? "bg-green-100/60 border-green-300 text-green-700" : "bg-red-100/60 border-red-300 text-red-600"}`}>
                        세그먼트 {aiResult.segment_defined ? "정의됨" : "미정의"}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${aiResult.root_cause_missing ? "bg-red-100/60 border-red-300 text-red-600" : "bg-green-100/60 border-green-300 text-green-700"}`}>
                        근본 원인 {aiResult.root_cause_missing ? "누락" : "있음"}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${aiResult.vanity_metric_detected ? "bg-orange-100/60 border-orange-300 text-orange-600" : "bg-green-100/60 border-green-300 text-green-700"}`}>
                        허상 지표 {aiResult.vanity_metric_detected ? "감지됨" : "없음"}
                      </span>
                    </div>

                    {aiResult.summary && (
                      <p className="text-sm text-slate-600 mb-4">{aiResult.summary}</p>
                    )}

                    {/* 목표 점수 슬라이더 */}
                    <div className="flex items-center gap-3 mb-3 print-hidden">
                      <span className="text-xs text-slate-400 shrink-0">목표</span>
                      <input
                        type="range" min={1} max={10} value={targetScore}
                        onChange={e => setTargetScore(Number(e.target.value))}
                        className="flex-1 h-1 accent-slate-500"
                      />
                      <span className="text-xs text-slate-500 w-8 text-right">{targetScore}점</span>
                    </div>

                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(100,116,139,0.2)" />
                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
                        <Radar
                          dataKey="target"
                          stroke="#94a3b8"
                          fill="transparent"
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                          dot={false}
                        />
                        <Radar
                          dataKey="value"
                          stroke="#475569"
                          fill="#475569"
                          fillOpacity={0.25}
                          dot={{ r: 3, fill: "#475569" }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>

                    {/* 항목별 점수 + 체크리스트 */}
                    <div className="space-y-3 mt-2">
                      {scoreRows.map(({ label, value, items }) => (
                        <div key={label}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16 shrink-0">{label}</span>
                            <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-500 rounded-full transition-all duration-500"
                                style={{ width: `${value * 10}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600 w-4 text-right shrink-0">{value}</span>
                          </div>
                          {items && items.length > 0 && (
                            <div className="ml-16 mt-1 space-y-0.5">
                              {items.map((item) => (
                                <div key={item.id} className="flex items-center gap-1.5 text-xs">
                                  <span className={item.met ? "text-green-500" : "text-red-400"}>
                                    {item.met ? "✓" : "✗"}
                                  </span>
                                  <span className={item.met ? "text-slate-400" : "text-slate-600"}>
                                    {item.criterion}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* 소크라테스 질문 — 항상 첫 번째 */}
                {aiResult.questions?.length > 0 && (
                  <GlassCard>
                    <div className="p-5">
                      <h2 className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                        <BrainCircuit size={14} />스스로 생각해보세요
                      </h2>
                      <p className="text-xs text-slate-400 mb-4">아래 질문에 답할 수 있다면 PRD가 탄탄한 겁니다.</p>
                      <ul className="text-sm text-slate-600 space-y-4">
                        {aiResult.questions.map((q, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-slate-300 shrink-0 font-medium">Q{i + 1}</span>
                            <span className="leading-relaxed">{q}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between print-hidden">
                        <p className="text-xs text-slate-400">질문을 바탕으로 PRD를 수정한 뒤 재분석하세요.</p>
                        <button onClick={handleRecheck} disabled={loading || !prevFeedback} className={`${btnBase} text-xs px-3 py-1.5`}>
                          <RotateCcw size={13} />재분석
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* 개선 제안 */}
                {aiResult.improvements?.length > 0 && (
                  <GlassCard>
                    <div className="p-5">
                      <h2 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5">
                        <Lightbulb size={14} />구조적 개선 제안
                      </h2>
                      <ul className="text-sm text-slate-600 space-y-2">
                        {aiResult.improvements.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-slate-300 shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </GlassCard>
                )}

                {/* 핵심 단절 */}
                {aiResult.critical_breakpoint && (
                  <GlassCard>
                    <div className="p-5">
                      <h2 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5"><AlertTriangle size={14} />핵심 단절</h2>
                      <p className="text-sm text-slate-600">{aiResult.critical_breakpoint}</p>
                    </div>
                  </GlassCard>
                )}

                {/* 잠재 리스크 */}
                {aiResult.hidden_risk && (
                  <GlassCard>
                    <div className="p-5">
                      <h2 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5"><ShieldAlert size={14} />잠재 리스크</h2>
                      <p className="text-sm text-slate-600">{aiResult.hidden_risk}</p>
                    </div>
                  </GlassCard>
                )}

                {/* AI 작성 의심도 */}
                {aiResult.ai_suspicion_score !== undefined && (
                  <GlassCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Bot size={14} />AI 작성 의심도</h2>
                        <span className={`text-sm font-semibold ${
                          aiResult.ai_suspicion_score >= 70 ? "text-red-500" :
                          aiResult.ai_suspicion_score >= 40 ? "text-orange-500" :
                          "text-green-600"
                        }`}>
                          {aiResult.ai_suspicion_score}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            aiResult.ai_suspicion_score >= 70 ? "bg-red-400" :
                            aiResult.ai_suspicion_score >= 40 ? "bg-orange-400" :
                            "bg-green-400"
                          }`}
                          style={{ width: `${aiResult.ai_suspicion_score}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500">{aiResult.ai_suspicion_reason}</p>
                    </div>
                  </GlassCard>
                )}

                {/* PRD 개선 초안 */}
                {aiResult.improvements?.length > 0 && (
                  <div className="flex print-hidden">
                    <button onClick={handleImprove} disabled={improving} className={btnBase}>
                      {improving ? "초안 작성 중..." : <><Sparkles size={14} />PRD 개선 초안 생성</>}
                    </button>
                  </div>
                )}

                {improving && (
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <div className="w-5 h-5 border-2 border-white/40 border-t-slate-400 rounded-full animate-spin" />
                    <span>개선된 PRD 초안 작성 중...</span>
                  </div>
                )}

                {improvedPrd && (
                  <GlassCard>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Sparkles size={14} />개선된 PRD 초안</h2>
                        <button
                          onClick={applyImprovedPrd}
                          className="print-hidden text-xs px-3 py-1 rounded-full border border-white/40 bg-white/20 text-slate-600 hover:bg-white/30 transition-all"
                        >
                          편집창에 적용
                        </button>
                      </div>
                      <pre className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {improvedPrd}
                      </pre>
                    </div>
                  </GlassCard>
                )}

                {/* 피드백 반영 여부 */}
                {prevFeedback && aiResult.feedback_reflected !== null && aiResult.feedback_comment && (
                  <GlassCard>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-sm font-medium text-slate-300">피드백 반영 여부</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${aiResult.feedback_reflected ? "bg-green-100/60 border-green-300 text-green-700" : "bg-red-100/60 border-red-300 text-red-600"}`}>
                          {aiResult.feedback_reflected ? "반영됨" : "미반영"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{aiResult.feedback_comment}</p>
                    </div>
                  </GlassCard>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
