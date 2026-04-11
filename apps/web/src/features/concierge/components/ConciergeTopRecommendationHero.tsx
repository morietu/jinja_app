"use client";

type Props = {
  name: string;
  href?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  topReasonLabel?: string | null;
  catchCopy: string;
  whyTop?: string | null;
  primaryReason: string;
  secondaryReason?: string | null;
  differenceFromOthers?: string | null;
  nextActionHint?: string | null;
  tags?: string[];
  routeLabel?: string;
  onRouteClick?: () => void;
};

export default function ConciergeTopRecommendationHero({
  name,
  href: _href,
  imageUrl: _imageUrl = null,
  address: _address = null,
  topReasonLabel: _topReasonLabel = null,
  catchCopy,
  whyTop: _whyTop = null,
  primaryReason: _primaryReason,
  secondaryReason: _secondaryReason = null,
  differenceFromOthers: _differenceFromOthers = null,
  nextActionHint: _nextActionHint = null,
  tags: _tags = [],
  routeLabel: _routeLabel = "経路案内",
  onRouteClick: _onRouteClick,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-base font-semibold text-slate-900">{name}</div>
      <div className="mt-2 text-sm text-slate-700">{catchCopy}</div>
    </div>
  );
}
