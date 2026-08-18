import { useEffect, useRef } from 'react';
import type { TelemetrySnapshot, TelemetryStore } from '../telemetry/TelemetryStore';
import { useTranslation } from '../i18n';
import { metricLabel, type MetricId, type TemplateNode } from './layout';
import { METRIC_SPECS } from './tiles';

export interface TileTemplateProps {
  readonly nodes: readonly TemplateNode[];
  readonly store: TelemetryStore;
}

/**
 * Renders an imported template.
 *
 * The structure comes from a third-party file, so only expected nodes are built, never free markup.
 * A container can only be a `div` or a `span`, with no attribute other than its class - no image,
 * no frame, no link. The file describes a layout, it does not inject HTML.
 */
export function TileTemplate({ nodes, store }: TileTemplateProps): React.JSX.Element {
  return (
    <>
      {nodes.map((node, index) => (
        <TemplateItem key={index} node={node} store={store} />
      ))}
    </>
  );
}

function TemplateItem({
  node,
  store,
}: {
  readonly node: TemplateNode;
  readonly store: TelemetryStore;
}): React.JSX.Element | null {
  if ('tag' in node) {
    const Tag = node.tag;
    return (
      <Tag className={node.class}>
        {(node.children ?? []).map((child, index) => (
          <TemplateItem key={index} node={child} store={store} />
        ))}
      </Tag>
    );
  }

  if ('text' in node) return <span className={node.class}>{node.text}</span>;
  if ('label' in node) return <TemplateLabel metric={node.label} className={node.class} />;
  if ('unit' in node) return <span className={node.class}>{unitOf(node.unit)}</span>;
  if ('value' in node) return <LiveValue metric={node.value} className={node.class} store={store} />;

  return null;
}

/** A separate component: the translated name is read through a hook, so not inline. */
function TemplateLabel({
  metric,
  className,
}: {
  readonly metric: MetricId;
  readonly className?: string | undefined;
}): React.JSX.Element {
  return <span className={className}>{metricLabel(metric, useTranslation())}</span>;
}

function unitOf(metric: MetricId): string {
  const spec = METRIC_SPECS[metric as keyof typeof METRIC_SPECS] as
    | (typeof METRIC_SPECS)[keyof typeof METRIC_SPECS]
    | undefined;
  return spec?.unit ?? '';
}

/** Value refreshed outside the React cycle, like the rest of the tiles. */
function LiveValue({
  metric,
  className,
  store,
}: {
  readonly metric: MetricId;
  readonly className: string | undefined;
  readonly store: TelemetryStore;
}): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return store.subscribe((snapshot: TelemetrySnapshot) => {
      const node = ref.current;
      if (node === null) return;
      const text = format(metric, snapshot);
      if (node.textContent !== text) node.textContent = text;
    });
  }, [metric, store]);

  return (
    <span ref={ref} className={className}>
      —
    </span>
  );
}

function format(metric: MetricId, snapshot: TelemetrySnapshot): string {
  if (metric === 'gear') {
    const gear = snapshot.frame.gear;
    return gear === null ? '—' : gear === 0 ? 'N' : String(gear);
  }

  const spec = METRIC_SPECS[metric as keyof typeof METRIC_SPECS] as
    | (typeof METRIC_SPECS)[keyof typeof METRIC_SPECS]
    | undefined;
  if (spec === undefined) return '—';

  const value = spec.extract(snapshot);
  return value === null ? '—' : spec.format(value);
}
