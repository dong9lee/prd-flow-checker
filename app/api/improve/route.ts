import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prd, improvements } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `너는 10년차 프로덕트 매니저다.
          원본 PRD와 구조적 개선 제안을 받아, 개선된 PRD 초안을 작성하라.

          규칙:
          - 원본 PRD의 맥락과 도메인을 유지하라
          - 개선 제안을 반영하되, 각 섹션은 3-5문장 이내로 간결하게 작성하라
          - 양으로 완성도를 채우지 마라. 불필요한 설명, 나열, 수식어는 제거하라
          - 핵심 논리만 남겨 밀도 있게 작성하라
          - 반드시 아래 5개 섹션을 모두 포함하고, 정확히 이 헤더명을 사용하라:
            [문제 정의], [사용자 세그먼트], [가설], [KPI], [기능]
          - 섹션 순서: 문제 정의 → 사용자 세그먼트 → 가설 → KPI → 기능
          - 마크다운 없이 plain text로 작성하라
          - 설명이나 부연 없이 PRD 본문만 출력하라`,
        },
        {
          role: "user",
          content: `[원본 PRD]
${prd}

[개선 제안]
${improvements.map((item: string, i: number) => `${i + 1}. ${item}`).join("\n")}

위 개선 제안을 반영한 PRD 초안을 작성하라.`,
        },
      ],
    });

    const improved_prd = response.choices[0].message.content ?? "";

    return NextResponse.json({ improved_prd });
  } catch (error) {
    console.error("개선 초안 생성 오류:", error);
    return NextResponse.json({ error: "초안 생성 실패" }, { status: 500 });
  }
}
