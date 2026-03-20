type ProposalParts = {
  concept: string | null;
  state: string | null;
  action: string | null;
};

export type StructuralInput = {
  matchedNeedTags: string[];
  astroElements: string[];
  benefitLabels: string[];
  explanationSummary?: string | null;
};

function isCompatLikeSummary(summary: string): boolean {
  return summary.includes("生年月日") || summary.includes("相性");
}

function pickProposalParts(input: StructuralInput): ProposalParts {
  const matched = input.matchedNeedTags;
  const astroElements = input.astroElements;
  const benefits = input.benefitLabels.join(" ");

  if (matched.includes("career") && matched.includes("courage")) {
    return {
      concept: "前進や勝負どころ",
      state: "流れを切り替えたい局面",
      action: "向き合う",
    };
  }

  if (matched.includes("mental") && matched.includes("rest")) {
    return {
      concept: "静けさと立て直し",
      state: "気持ちが散っている状態",
      action: "整える",
    };
  }

  if (matched.includes("love")) {
    return {
      concept: "縁や関係性",
      state: "人とのつながりを見直したい局面",
      action: "育て直す",
    };
  }

  if (benefits.includes("勝運") || benefits.includes("仕事運")) {
    return {
      concept: "前進と突破",
      state: "停滞や迷いがある局面",
      action: "進める",
    };
  }

  if (benefits.includes("厄除") || benefits.includes("家内安全")) {
    return {
      concept: "守りと安定",
      state: "不安定さを立て直したい局面",
      action: "整え直す",
    };
  }

  if (astroElements.includes("土")) {
    return {
      concept: "安定と蓄積",
      state: "足元を固めたい局面",
      action: "整える",
    };
  }

  return {
    concept: "流れの整理",
    state: "立ち止まって整えたい局面",
    action: "向き合う",
  };
}

export function buildStructuralProposal(input: StructuralInput): string {
  const { concept, state, action } = pickProposalParts(input);
  return `${concept}を意識しながら、${state}に${action}したいときに向く神社です。`;
}

export function buildStructuralProposalReason(input: StructuralInput): string {
  const summary = (input.explanationSummary ?? "").trim();
  const matched = input.matchedNeedTags;
  const astroElements = input.astroElements;
  const benefitLabels = input.benefitLabels;

  if (summary && !isCompatLikeSummary(summary)) return summary;

  if (matched.includes("career") && matched.includes("courage")) {
    return "前進や勝負どころを支える性質があり、転機や仕事に向き合いたい状態と噛み合います。";
  }

  if (matched.includes("mental") && matched.includes("rest")) {
    return "落ち着きや休息につながる要素があり、気持ちを整え直したい状態と重なっています。";
  }

  if (benefitLabels.length > 0) {
    return `ご利益として ${benefitLabels.slice(0, 2).join("・")} があり、今回の参拝目的と接点があります。`;
  }

  if (astroElements.length > 0) {
    return `この神社が持つ要素（${astroElements.join("・")}）が、参拝で得たい方向性と重なっています。`;
  }

  return "神社の性質とご利益から見て、今回の目的と接点があります。";
}

export function buildCompatSummary(
  input: Pick<StructuralInput, "astroElements"> & { scoreElement?: number | null },
): string | null {
  const scoreElement = input.scoreElement ?? 0;
  const astroElements = input.astroElements;

  if (scoreElement >= 2 && astroElements.length > 0) {
    return `${astroElements.join("・")}の性質と相性がよい候補です。`;
  }
  if (scoreElement >= 1) {
    return "生年月日由来の相性も踏まえた候補です。";
  }

  return null;
}

export function buildCompatReason(
  input: Pick<StructuralInput, "astroElements"> & { scoreElement?: number | null },
): string | null {
  const scoreElement = input.scoreElement ?? 0;
  const astroElements = input.astroElements;

  if (astroElements.length > 0 && scoreElement >= 2) {
    return `あなたの傾向と、この神社が持つ要素（${astroElements.join("・")}）が強く噛み合っています。`;
  }
  if (astroElements.length > 0 && scoreElement >= 1) {
    return `あなたの傾向と、この神社が持つ要素（${astroElements.join("・")}）に接点があります。`;
  }

  return null;
}
