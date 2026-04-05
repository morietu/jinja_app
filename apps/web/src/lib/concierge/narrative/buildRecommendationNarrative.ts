import type {
  BuildNarrativeBaseArgs,
  ConciergeMode,
  NeedTag,
  RecommendationNarrative,
  ShrineTone,
} from "@/lib/concierge/narrative/types";
import { buildPsychologicalTags } from "@/lib/concierge/narrative/buildPsychologicalTags";
import { buildSymbolTags } from "@/lib/concierge/narrative/buildSymbolTags";
import { buildMeaningShort } from "@/lib/concierge/narrative/buildMeaningShort";
import { buildRankReason } from "@/lib/concierge/narrative/buildRankReason";
import { buildComparisonText } from "@/lib/concierge/narrative/buildComparisonText";
import { sanitizeCopyText } from "@/lib/concierge/conciergeCopyRules";
import { resolveTurningPoint } from "@/lib/concierge/turningPoint/resolveTurningPoint";
import { buildTurningPointSentence } from "@/lib/concierge/turningPoint/buildTurningPointSentence";
/**
 * 主
 * 今の状態や、今回の相談の中心テーマを短く出す
 */
function buildStateSentence(args: {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
  userElementLabel?: string | null;
  shrineElementLabels?: string[] | null;
  primaryReasonLabel?: string | null;
  explanationPayload?: { primary_need_label_ja?: string | null } | null;
  deepReason?: { interpretation?: string | null } | null;
  conciergeReason?: string | null;
  ctx?: "map" | "concierge" | null;
}): string {
  const mode = args.mode;
  const primary = args.primaryNeed ?? null;
  const secondary = args.secondaryNeedTags ?? [];

  if (args.ctx === "concierge" && args.deepReason?.interpretation) {
    return args.deepReason.interpretation;
  }

  if (args.ctx === "concierge" && args.conciergeReason?.trim()) {
    return args.conciergeReason.trim();
  }

  if (mode === "compat") {
    const user = args.userElementLabel ?? "今回の生年月日傾向";
    const shrine = (args.shrineElementLabels ?? []).filter(Boolean).slice(0, 2).join("・");

    if (shrine) {
      return `${user}から見ると、この神社は相性を見やすいです。`;
    }

    if (args.primaryReasonLabel) {
      return `${user}を主軸に見ると、今回の相談とも重なります。`;
    }

    return `${user}から見ると、この神社は合いやすいです。`;
  }

  if (primary === "courage") {
    return secondary.includes("money")
      ? "動き出すきっかけと、流れの立て直しが中心です。"
      : "動き出すきっかけを整えるのが中心です。";
  }

  if (primary === "money") {
    return secondary.includes("courage")
      ? "巡りを整えながら、動き出す流れも見ています。"
      : "金運や巡りを整え直すことが中心です。";
  }

  if (primary === "career") {
    return secondary.includes("courage")
      ? "仕事や転機を見直しながら、前進も見ています。"
      : "仕事や転機への向き合い方を整えるのが中心です。";
  }

  if (primary === "mental") {
    return secondary.includes("rest")
      ? "気持ちを整えながら、休める形に戻すことが中心です。"
      : "不安や気持ちの揺れを整えるのが中心です。";
  }

  if (primary === "rest") {
    return secondary.includes("mental")
      ? "休みながら、気持ちも整え直すことが中心です。"
      : "無理を止めて、休める形に戻すのが中心です。";
  }

  if (primary === "love") {
    return "良縁や関係の流れを整えることが中心です。";
  }

  if (primary === "study") {
    return "集中や目標の定め直しが中心です。";
  }

  return args.explanationPayload?.primary_need_label_ja
    ? `${args.explanationPayload.primary_need_label_ja}を整えることが中心です。`
    : "今の状態を整え直すことが中心です。";
}

function buildNeedMatchText(primary: NeedTag | null, secondary: NeedTag[]): string {
  if (primary === "courage") {
    return secondary.includes("money")
      ? "行動のきっかけや後押しを求める意図が中心にあり、金運面も立て直したい流れが見られます。"
      : "行動のきっかけや後押しを求める意図が相談の中心にあります。";
  }

  if (primary === "money") {
    return secondary.includes("courage")
      ? "金運や流れを立て直したい意図が中心にあり、動き出すきっかけも求めている状態です。"
      : "金運や流れを立て直したい意図が相談の中心にあります。";
  }

  if (primary === "career") {
    return secondary.includes("courage")
      ? "仕事や転機への意識が中心にあり、前に進むきっかけも必要としている状態です。"
      : "仕事や転機に向き合いたい意図が相談の中心にあります。";
  }

  if (primary === "mental") {
    return secondary.includes("rest")
      ? "不安や気持ちの揺れを整えたい意図が中心にあり、落ち着いて休みたい状態も見られます。"
      : "不安や気持ちの揺れを整えたい意図が相談の中心にあります。";
  }

  if (primary === "rest") {
    return secondary.includes("mental")
      ? "休息したい意図が中心にあり、気持ちの揺れも整えたい状態が見られます。"
      : "落ち着いて休みたい意図が相談の中心にあります。";
  }

  if (primary === "love") {
    return "良縁や恋愛を前向きに進めたい意図が相談の中心にあります。";
  }

  if (primary === "study") {
    return "学業や合格に集中したい意図が相談の中心にあります。";
  }

  return "相談内容の中に、今の状態を整えたい意図が見られます。";
}

function buildCompatMatchText(args: {
  userElementLabel?: string | null;
  shrineElementLabels?: string[] | null;
  primaryReasonLabel?: string | null;
}): string {
  const user = args.userElementLabel ?? "今回の生年月日傾向";
  const shrine = (args.shrineElementLabels ?? []).filter(Boolean).slice(0, 2).join("・");

  if (shrine) {
    return `${user}と、${shrine}の要素を持つこの神社の噛み合いを主軸に見ています。`;
  }

  if (args.primaryReasonLabel) {
    return `${user}を主軸に見つつ、${args.primaryReasonLabel}に関わる相談内容との重なりも補助的に見ています。`;
  }

  return `${user}と、この神社が持つ要素の噛み合いを主軸に見ています。`;
}

function buildShrineBenefitText(args: {
  shrineName?: string | null;
  benefitLabels?: string[];
  primaryNeed?: NeedTag | null;
  shrineTone?: ShrineTone;
}): string {
  const shrineText = args.shrineName?.trim() || "この神社";
  const benefitLabels = args.benefitLabels ?? [];
  const primaryNeed = args.primaryNeed ?? null;
  const shrineTone = args.shrineTone ?? "neutral";

  const labels = benefitLabels.filter(Boolean).slice(0, 3);
  const joined =
    labels.length >= 3
      ? `${labels[0]}・${labels[1]}・${labels[2]}`
      : labels.length === 2
        ? `${labels[0]}と${labels[1]}`
        : labels.length === 1
          ? labels[0]
          : null;

  if (!joined) {
    return `${shrineText}は、今回の相談内容に照らして、気持ちや優先順位を整え直す節目として置きやすい神社です。`;
  }

  if (primaryNeed === "courage") {
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、止まっている流れを動かし始める節目や、背中を押す場として据えやすい神社です。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、迷いを断ち切って一歩を決めたい段階で判断材料にしやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、勢いで進むより気持ちを整えてから一歩を決めたい段階で節目として置きやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、次の一歩を踏み出すきっかけを持ちたい段階で参拝先として据えやすい神社です。`;
  }

  if (primaryNeed === "money") {
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、停滞した巡りを切り替えて流れを再開したい段階で節目として置きやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、金運や巡りを焦らず整え直したい段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、金運や巡りの停滞を立て直したい段階で意識を向けやすい神社です。`;
  }

  if (primaryNeed === "mental") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、揺れた気持ちを静かに整え直し、落ち着きを取り戻したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、沈んだ流れを切り替えつつ気持ちを立て直したい段階で節目として置きやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、気持ちを整えながら無理のない形で立て直したい段階で気持ちを向けやすい神社です。`;
  }

  if (primaryNeed === "career") {
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への姿勢を引き締め、判断をぶらさず整理したい段階で判断材料にしやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への向き合い方を急がず見直したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への向き合い方を整理し、次の判断を落ち着いて考えたい段階で節目として置きやすい神社です。`;
  }

  if (primaryNeed === "rest") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、消耗した状態を静かに整え直したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、無理に進まず消耗を立て直したい段階で参拝先として置きやすい神社です。`;
  }

  if (primaryNeed === "love") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、良縁や恋愛に対して気持ちを静かに整えたい段階で気持ちを向けやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、良縁や恋愛を丁寧に見直しながら前へ進めたい段階で参拝先として据えやすい神社です。`;
  }

  if (primaryNeed === "study") {
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、学業や合格に向けて気持ちを引き締め直したい段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、学業や合格に向けて乱れた集中やペースを立て直したい段階で参拝先として置きやすい神社です。`;
  }

  return `${shrineText}は${joined}に関わるご利益で知られ、今回の相談内容に照らして参拝先として検討しやすい神社です。`;
}

function needLabelJa(tag: NeedTag): string {
  if (tag === "money") return "金運";
  if (tag === "courage") return "前に進むきっかけ";
  if (tag === "career") return "仕事や転機";
  if (tag === "mental") return "不安や気持ちの揺れ";
  if (tag === "rest") return "休息";
  if (tag === "love") return "良縁や恋愛";
  return "学業や合格";
}

function buildActionMeaningText(args: {
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
  shrineName?: string | null;
  shrineTone?: ShrineTone;
}): string {
  const primary = args.primaryNeed ?? null;
  const secondary = args.secondaryNeedTags ?? [];
  const shrineText = args.shrineName?.trim() || "この神社";
  const shrineTone = args.shrineTone ?? "neutral";

  if (secondary.length === 0) {
    if (primary === "courage") {
      if (shrineTone === "strong") {
        return `${shrineText}は、静かに様子を見る場というより、止まった流れを切り替える節目として使いやすい神社です。`;
      }
      if (shrineTone === "tight") {
        return `${shrineText}は、勢いで動く場というより、迷いを整理して一歩を定めるための神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、強く背中を押す場というより、気持ちを整えてから一歩を決めるための神社です。`;
      }
      return `${shrineText}は、結論を急ぐより、まず最初の一歩を決めたい段階で向いています。`;
    }

    if (primary === "money") {
      if (shrineTone === "strong") {
        return `${shrineText}は、運を待つ場というより、停滞した流れを切り替える節目として使いやすい神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、一気の好転を狙う場というより、巡りを落ち着いて整え直すための神社です。`;
      }
      return `${shrineText}は、金運や巡りを整え直したい今の段階で向いています。`;
    }

    if (primary === "career") {
      if (shrineTone === "tight") {
        return `${shrineText}は、感覚で決める場というより、仕事や転機への姿勢を引き締めて判断するための神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、結論を急ぐ場というより、向き合い方を静かに整理するための神社です。`;
      }
      return `${shrineText}は、仕事や転機への向き合い方を整えたい今の段階で向いています。`;
    }

    if (primary === "mental") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、強く前へ押し出す場というより、揺れた気持ちを静かに整え直すための神社です。`;
      }
      if (shrineTone === "strong") {
        return `${shrineText}は、ただ休む場というより、沈んだ流れを切り替えて立て直す節目として使いやすい神社です。`;
      }
      if (shrineTone === "tight") {
        return `${shrineText}は、感情に流されるまま過ごすより、気持ちを引き締めて整えたい段階で向いています。`;
      }
      return `${shrineText}は、不安や揺れを整えたい今の段階で向いています。`;
    }

    if (primary === "rest") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、何かを進める場というより、消耗を静かに整え直すための神社です。`;
      }
      return `${shrineText}は、無理に予定を前へ進めるより、疲れを立て直したい今の段階で向いています。`;
    }

    if (primary === "love") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、気持ちを勢いで動かす場というより、関係性を静かに見直すための神社です。`;
      }
      return `${shrineText}は、良縁や関係性を丁寧に整えたい今の段階で向いています。`;
    }

    if (primary === "study") {
      if (shrineTone === "tight") {
        return `${shrineText}は、焦って結果だけを追う場というより、集中や姿勢を引き締め直すための神社です。`;
      }
      return `${shrineText}は、学業や合格に向けた集中を整え直したい今の段階で向いています。`;
    }

    return `${shrineText}は、今の状態を整えながら次を決めたい今の段階で向いています。`;
  }

  if (primary === "courage" && secondary.includes("money")) {
    return `${shrineText}は、背中を押してほしい気持ちに加えて、金運や巡りの停滞も立て直したい今の段階で向いています。`;
  }

  if (primary === "money" && secondary.includes("courage")) {
    if (shrineTone === "strong") {
      return `${shrineText}は、停滞した巡りを切り替えつつ、止まった状態から動き出すきっかけも欲しい今の段階で向いています。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は、巡りを焦って変えるより、落ち着いて整えながら次の一歩も決めたい今の段階で向いています。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、巡りを立て直しつつ、迷いを絞って動き出す判断も固めたい今の段階で向いています。`;
    }
    return `${shrineText}は、巡りを整えるだけでなく、止まった状態から動き出すきっかけも欲しい今の段階で向いています。`;
  }

  if (primary === "career" && secondary.includes("courage")) {
    if (shrineTone === "strong") {
      return `${shrineText}は、仕事や転機への向き合い方を整理しながら、次の一歩へ切り替える節目も欲しい今の段階で向いています。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は、仕事や転機への向き合い方を静かに見直しながら、急がず次の一歩も定めたい今の段階で向いています。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、仕事や転機への姿勢を引き締めつつ、迷いを減らして次の一歩を決めたい今の段階で向いています。`;
    }
    return `${shrineText}は、仕事や転機への向き合い方を整理しつつ、次の一歩も決めたい今の段階で向いています。`;
  }

  if (primary === "mental" && secondary.includes("rest")) {
    if (shrineTone === "quiet") {
      return `${shrineText}は、気持ちを静かに整えながら、無理に進まず休みつつ立て直したい今の段階で向いています。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は、沈んだ流れを切り替えながら、気持ちと休息の両方を立て直したい今の段階で向いています。`;
    }
    return `${shrineText}は、気持ちを整えることに加えて、無理に進まず休みながら立て直したい今の段階で向いています。`;
  }

  if (primary === "rest" && secondary.includes("mental")) {
    if (shrineTone === "quiet") {
      return `${shrineText}は、休息を取りながら、気持ちの揺れも静かに整え直したい今の段階で一度立ち止まる場として使いやすい神社です。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は、休息を取りながら、沈んだ流れも切り替えて立て直したい今の段階で節目として置きやすい神社です。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、休息を取りながら、気持ちの揺れを引き締め直して整えたい今の段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は、休息を取りながら、気持ちの揺れも静かに整え直したい今の段階で向いています。`;
  }

  return `${shrineText}は、${secondary.map(needLabelJa).join("、")}も視野に入れながら、優先順位を落ち着いて整理したい段階で向いています。`;
}

function buildStateStuckText(args: { mode: ConciergeMode; primaryNeed?: NeedTag | null }): string {
  const primary = args.primaryNeed ?? null;

  if (args.mode === "compat") {
    return "今は勢いで答えを出すほど感覚がぶれやすく、合う・合わないを静かに見極めたい状態です。";
  }

  if (primary === "mental") {
    return "不安や引っかかりが続く時は、考えるほど判断が散って、気持ちの消耗が先に進みやすくなります。";
  }

  if (primary === "career") {
    return "仕事のことを考え続けている時は、動き方より先に優先順位が崩れて、判断が散りやすくなります。";
  }

  if (primary === "money") {
    return "流れを変えたい時ほど、焦って手を打つほど空回りしやすく、立て直しの軸がぼやけやすくなります。";
  }

  if (primary === "courage") {
    return "切り替えたい気持ちが強い時ほど、急いで結論を出そうとして判断が粗くなり、流れの見極めが雑になりやすくなります。";
  }

  if (primary === "love") {
    return "関係のことを気にし続けている時は、相手より先に自分の受け取り方が揺れて、気持ちの置き場が散りやすくなります。";
  }

  if (primary === "rest") {
    return "消耗が続いている時は、休むことにも判断が要りはじめて、止まるべき場面でも気持ちが落ち着きにくくなります。";
  }

  if (primary === "study") {
    return "結果を意識し続けている時は、やるべきことより不安の処理が先に膨らみ、集中の軸がぶれやすくなります。";
  }

  return "今は答えを急ぐほど判断が散りやすく、先に状態を整えられる候補から見た方が意味づけしやすい状態です。";
}

function buildStatePriorityText(args: { mode: ConciergeMode; primaryNeed?: NeedTag | null }): string {
  const primary = args.primaryNeed ?? null;

  if (args.mode === "compat") {
    return "今は結論を急ぐより、相性として無理がないか、落ち着いて受け取れる場所かを先に整理するのが合っています。";
  }

  if (primary === "mental") {
    return "今は解決策を増やすより先に、気持ちを落ち着かせて、何を立て直したいのかを整理できる場を優先するのが合っています。";
  }

  if (primary === "career") {
    return "今は次の一手を増やすより先に、何を進めて何を止めるかを整理できる場を優先するのが合っています。";
  }

  if (primary === "money") {
    return "今は一発で変えることより先に、止まった流れを整え直して、立て直しの軸を作れる場を優先するのが合っています。";
  }

  if (primary === "courage") {
    return "今は答えを急いで決めるより先に、どこを切り替えて何を残すかを整理できる場を優先するのが合っています。";
  }

  if (primary === "love") {
    return "今は相手の反応を追うより先に、自分の気持ちの置き場を整えて、関係をどう見たいかを整理できる場を優先するのが合っています。";
  }

  if (primary === "rest") {
    return "今は無理に立て直そうとするより先に、消耗を増やさず整える順番を取り戻せる場を優先するのが合っています。";
  }

  if (primary === "study") {
    return "今は量を増やすより先に、集中を削っている要因を静かに整理できる場を優先するのが合っています。";
  }

  return "今は答えを出すことより先に、状態を整えながら優先順位を見直せる場を優先するのが合っています。";
}

function buildStateShrineMeaningText(args: {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  shrineName?: string | null;
  shrineTone?: ShrineTone;
  benefitLabels?: string[];
}): string {
  const primaryNeed = args.primaryNeed ?? null;
  const shrineTone = args.shrineTone ?? "neutral";

  return buildShrineBenefitText({
    shrineName: args.shrineName,
    benefitLabels: args.benefitLabels,
    primaryNeed,
    shrineTone,
  });
}

function buildConsultationSummary(args: {
  mode: ConciergeMode;
  primaryNeed?: NeedTag | null;
  shrineName?: string | null;
  shrineTone?: ShrineTone;
  benefitLabels?: string[];
}): string {
  const stuck = buildStateStuckText({
    mode: args.mode,
    primaryNeed: args.primaryNeed,
  });

  const priority = buildStatePriorityText({
    mode: args.mode,
    primaryNeed: args.primaryNeed,
  });

  const shrineMeaning = buildStateShrineMeaningText({
    mode: args.mode,
    primaryNeed: args.primaryNeed,
    shrineName: args.shrineName,
    shrineTone: args.shrineTone,
    benefitLabels: args.benefitLabels,
  });

  return `${stuck} ${priority} ${shrineMeaning}`;
}

function buildMeaningSentence(args: {
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
  shrineName?: string | null;
  shrineTone?: ShrineTone;
  conciergeReason?: string | null;
}): string {
  const short = buildMeaningShort({
    shrineName: args.shrineName,
    primaryNeed: args.primaryNeed ?? null,
    shrineTone: args.shrineTone ?? "neutral",
    fallbackText: args.conciergeReason ?? null,
  });

  if (short?.trim()) {
    return `${args.shrineName?.trim() || "この神社"}は、${short.trim()}流れに合いやすいです。`;
  }

  return `${args.shrineName?.trim() || "この神社"}は、今の状態を整え直す節目に向いています。`;
}

export function buildRecommendationNarrative(args: BuildNarrativeBaseArgs): RecommendationNarrative {
  const mode = args.mode;
  const primaryNeed = args.primaryNeed ?? null;
  const secondaryNeeds = args.secondaryNeedTags ?? [];
  const shrineTone = args.shrineTone ?? "neutral";

  const userState =
    mode === "compat"
      ? buildCompatMatchText({
          userElementLabel: args.userElementLabel,
          shrineElementLabels: args.benefitLabels,
          primaryReasonLabel: args.primaryReasonLabel,
        })
      : buildNeedMatchText(primaryNeed, secondaryNeeds);

  const shrineBenefit = buildShrineBenefitText({
    shrineName: args.shrineName,
    benefitLabels: args.benefitLabels,
    primaryNeed,
    shrineTone,
  });

  const actionMeaning = buildActionMeaningText({
    primaryNeed,
    secondaryNeedTags: secondaryNeeds,
    shrineName: args.shrineName,
    shrineTone,
  });

  const stateSentence = buildStateSentence({
    mode,
    primaryNeed,
    secondaryNeedTags: secondaryNeeds,
    userElementLabel: args.userElementLabel,
    shrineElementLabels: args.benefitLabels,
    primaryReasonLabel: args.primaryReasonLabel,
    explanationPayload: args.explanationPayload ?? null,
    deepReason: args.deepReason ?? null,
    conciergeReason: args.conciergeReason ?? null,
    ctx: "concierge",
  });

  const consultationSummary = buildConsultationSummary({
    mode,
    primaryNeed,
    shrineName: args.shrineName,
    shrineTone,
    benefitLabels: args.benefitLabels,
  });



  const meaningSentence = buildMeaningSentence({
    primaryNeed,
    secondaryNeedTags: secondaryNeeds,
    shrineName: args.shrineName,
    shrineTone,
    conciergeReason: args.conciergeReason ?? null,
  });

  const rankReason = buildRankReason({
    mode,
    breakdown: args.breakdown,
    primaryNeed,
    secondaryNeedTags: secondaryNeeds,
  });

  const comparisonText = buildComparisonText({
    mode,
    primaryNeed,
    shrineName: args.shrineName,
    shrineTone,
  });

  const psychologicalTags = buildPsychologicalTags({
    primaryNeed,
    secondaryNeeds,
  });

  const derivedSymbolTags = buildSymbolTags({
    psychologicalTags,
  });

  const symbolTags = Array.from(new Set([...(args.shrineSymbolTags ?? []), ...derivedSymbolTags]));

  const turningPointMeta = resolveTurningPoint({
    primaryNeed,
    secondaryNeedTags: secondaryNeeds,
  });

  const turningPointSentence = buildTurningPointSentence({
    turningPoint: turningPointMeta,
  });

  return {
    mode,
    primaryNeed,
    secondaryNeeds,
    shrineTone,
    breakdown: args.breakdown ?? null,
    psychologicalTags,
    symbolTags,
    turningPoint: {
      type: turningPointMeta.type,
      label: turningPointMeta.label,
      shortLabel: turningPointMeta.shortLabel,
      sentence: sanitizeCopyText(turningPointSentence),
    },
    meaning: {
      short: sanitizeCopyText(meaningSentence),
      lead: sanitizeCopyText(stateSentence),
      consultationSummary: sanitizeCopyText(consultationSummary),
    },
    match: {
      userState: sanitizeCopyText(userState),
      shrineBenefit: sanitizeCopyText(shrineBenefit),
      actionMeaning: sanitizeCopyText(actionMeaning),
    },
    ranking: {
      rankReason,
      comparisonText,
    },
    shrine: {
      shrineMeaning: sanitizeCopyText(args.deepReason?.shrineMeaning ?? shrineBenefit),
    },
  };
}
