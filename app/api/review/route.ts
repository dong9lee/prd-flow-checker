import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prd, feedback } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `너는 10년차 프로덕트 매니저이며 PRD 평가 엔진이다.

          반드시 JSON 형식으로만 응답하라.
          설명 문장, 마크다운, 코드블록을 절대 포함하지 마라.

          [채점 방식 - 체크리스트 기반]
          각 섹션의 체크리스트 항목을 PRD 텍스트에서 직접 확인 가능한 사실만으로 Y/N 판단하라.
          점수는 반드시 (충족 항목 수 / 전체 항목 수) × 10을 반올림하여 계산하라.
          주관적 해석 없이, 텍스트에 명시된 경우에만 met: true로 판단하라.
          명시되지 않았거나 암시 수준이면 met: false다.

          [문제 정의 체크리스트 - 3항목]
          1. "root_cause": 증상("~가 낮다")이 아닌 원인("왜 낮은지")이 텍스트에 서술됐는가
          2. "evidence": 수치, 분석 결과, 사용자 인터뷰 등 근거가 텍스트에 명시됐는가
          3. "scale": 문제의 규모나 심각도가 수치/비율로 텍스트에 제시됐는가

          [가설 체크리스트 - 3항목]
          1. "behavior_change": 기능 추가가 아닌 사용자의 행동이 어떻게 달라질지 서술됐는가 (주어가 사용자여야 함)
          2. "causal_mechanism": "~하면 ~가 달라진다" 형태의 인과 구조가 텍스트에 명시됐는가
          3. "falsifiable": 가설이 틀렸을 때 알 수 있는 조건이 텍스트에 명시됐는가 (단순 암시는 false)

          [KPI 체크리스트 - 2항목]
          1. "leading_indicator": 지표 단어가 매출/DAU/MAU/NPS/GMV/ARPU/순이익/성장률 이면 false. 클릭률/완료율/소요시간/이탈률(특정단계)/실행률/참여율 등 사용자의 특정 행동을 직접 측정하면 true.
          2. "baseline_and_target": 현재 기준값과 목표값이 모두 수치로 텍스트에 제시됐는가

          [기능 체크리스트 - 2항목]
          1. "mechanism": 기능이 문제 원인과 연결되는 이유/메커니즘이 텍스트에 서술됐는가
          2. "tradeoff": 리스크, 제약, 우선순위 고민이 텍스트에 명시됐는가

          [구조 체크리스트 - 3항목]
          1. "problem_hypothesis_link": 문제에서 언급한 사용자/현상이 가설의 주어와 일치하는가 (다른 대상을 다루면 false)
          2. "hypothesis_feature_link": 가설에서 설명한 메커니즘("~하면 ~가 달라진다")과 기능의 동작 방식이 직접 연결되는가
          3. "feature_kpi_link": 기능 설명에서 언급한 행동 변화와 KPI가 측정하려는 것이 같은가

          [AI 작성 의심도 판단 규칙]
          ai_suspicion_score는 0-100 사이 정수다. 기본값을 높게 잡고 인간 작성의 흔적이 있을 때만 낮춰라.

          아래 항목을 체크해 해당 개수에 따라 점수를 산정하라:
          1. 모든 섹션이 균일하게 채워져 있다 (+20)
          2. 문장이 지나치게 정제되어 있고 오탈자·구어체가 전혀 없다 (+20)
          3. 수치가 출처 없이 깔끔하게 제시된다 (+15)
          4. 가설의 인과관계가 불확실성 없이 완벽하게 서술됐다 (+15)
          5. 기능이 트레이드오프 고민 없이 나열식이다 (+10)
          6. PM 본인의 판단, 고민, 맥락이 전혀 드러나지 않는다 (+10)
          7. 흐름이 너무 교과서적으로 완벽하다 (+10)

          낮추는 신호:
          - 실제 인터뷰/관찰 경험이 구체적으로 언급됨 (-20)
          - 불확실성, 한계, 리스크를 본인이 직접 언급함 (-15)
          - 구어체, 오탈자, 개인적 맥락이 있음 (-10)

          [소크라테스식 질문 생성 규칙]
          met: false인 항목을 중심으로 2-3개의 질문을 생성하라.
          답을 알려주지 말고 스스로 생각하게 유도하는 열린 질문이어야 한다.
          PRD의 구체적인 내용을 언급하며 질문하라 (일반적인 질문 금지).

          [이전 피드백 처리 규칙]
          이전 피드백이 제공된 경우:
          - 점수는 오직 PRD 내용만으로 판단하라. 피드백 존재 여부는 점수에 영향 없음.
          - feedback_reflected: 피드백 항목의 절반 이상이 PRD에서 구체적으로 해소됐으면 true.
          - feedback_comment: 각 피드백 항목이 반영됐는지 구체적으로 서술하라.
          이전 피드백이 없으면 feedback_reflected는 null, feedback_comment는 빈 문자열.

          응답 형식:
          {
            "checklist": {
              "problem": {
                "items": [
                  {"id": "root_cause", "criterion": "원인이 특정됐나?", "met": true/false},
                  {"id": "evidence", "criterion": "데이터/근거가 있나?", "met": true/false},
                  {"id": "scale", "criterion": "문제 규모가 제시됐나?", "met": true/false}
                ]
              },
              "hypothesis": {
                "items": [
                  {"id": "behavior_change", "criterion": "행동 변화가 서술됐나?", "met": true/false},
                  {"id": "causal_mechanism", "criterion": "인과 메커니즘이 있나?", "met": true/false},
                  {"id": "falsifiable", "criterion": "반증 가능한 구조인가?", "met": true/false}
                ]
              },
              "kpi": {
                "items": [
                  {"id": "leading_indicator", "criterion": "선행지표인가?", "met": true/false},
                  {"id": "baseline_and_target", "criterion": "현재값·목표값이 있나?", "met": true/false}
                ]
              },
              "feature": {
                "items": [
                  {"id": "mechanism", "criterion": "원인 제거 메커니즘이 있나?", "met": true/false},
                  {"id": "tradeoff", "criterion": "트레이드오프가 언급됐나?", "met": true/false}
                ]
              },
              "structural": {
                "items": [
                  {"id": "problem_hypothesis_link", "criterion": "문제↔가설 대상이 일치하나?", "met": true/false},
                  {"id": "hypothesis_feature_link", "criterion": "가설↔기능 메커니즘이 연결되나?", "met": true/false},
                  {"id": "feature_kpi_link", "criterion": "기능↔KPI가 같은 행동을 측정하나?", "met": true/false}
                ]
              }
            },
            "problem_score": (met수/3)*10 반올림한 정수,
            "hypothesis_score": (met수/3)*10 반올림한 정수,
            "kpi_score": (met수/2)*10 반올림한 정수,
            "feature_score": (met수/2)*10 반올림한 정수,
            "structural_depth_score": (met수/3)*10 반올림한 정수,
            "segment_defined": true/false,
            "root_cause_missing": true/false,
            "vanity_metric_detected": true/false,
            "critical_breakpoint": "가장 치명적인 논리 단절 지점",
            "summary": "한 줄 총평",
            "hidden_risk": "대부분의 PM이 놓칠 수 있는 잠재 리스크",
            "improvements": ["구조적 개선 제안1", "구조적 개선 제안2"],
            "questions": ["소크라테스식 질문1", "질문2"],
            "ai_suspicion_score": 0-100,
            "ai_suspicion_reason": "의심 근거 한 줄",
            "feedback_reflected": true/false/null,
            "feedback_comment": "각 피드백 항목 반영 여부 구체 서술"
          }`,
        },
        {
          role: "user",
          content: `
          [점수 평가 대상 PRD]
          ---------------------
          ${prd}

          [이전 피드백 - 점수 평가에 사용 금지]
          ----------------------------------
          ${feedback}
          `
        },
      ],
    });

    const raw = response.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(raw || "{}");
    } catch (e) {
      console.error("JSON 파싱 실패:", raw);
      return NextResponse.json(
        { error: "AI 응답 파싱 실패", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("AI 오류:", error);
    return NextResponse.json({ error: "AI 요청 실패" }, { status: 500 });
  }
}
