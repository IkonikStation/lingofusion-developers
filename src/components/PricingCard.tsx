import type { ReactNode } from "react";

type DisplayTextModel = {
  model: string;
  input: string;
  output: string;
  recommended?: boolean;
};

type DisplaySimpleModel = {
  model: string;
  price: string;
};

type DisplayImageModel = {
  size: string;
  price: string;
};

type PricingCardHeader = {
  headerAction?: ReactNode;
  headerNote?: ReactNode;
  tableClassName?: string;
};

type PricingCardProps = PricingCardHeader &
  (
    | {
      title: string;
      unit: string;
      kind: "text";
      rows: DisplayTextModel[];
      labels: PricingLabels;
    }
    | {
      title: string;
      unit: string;
      kind: "simple";
      rows: DisplaySimpleModel[];
      labels: PricingLabels;
    }
    | {
      title: string;
      unit: string;
      kind: "image";
      rows: DisplayImageModel[];
      labels: PricingLabels;
    }
  );

export type PricingLabels = {
  model: string;
  input: string;
  output: string;
  price: string;
  imageSize: string;
  recommended: string;
};

export function PricingCard(props: PricingCardProps) {
  return (
    <section className="scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-white/10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">{props.title}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-500">{props.unit}</p>
        </div>
        {props.headerAction && <div className="shrink-0">{props.headerAction}</div>}
      </div>

      {props.headerNote && (
        <div className="mb-4 text-sm leading-6 text-neutral-600 dark:text-neutral-400" aria-live="polite">
          {props.headerNote}
        </div>
      )}

      <div className={`surface-lift overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-[#161616] ${props.tableClassName ?? ""}`}>
        {props.kind === "text" && <TextTable rows={props.rows} labels={props.labels} />}
        {props.kind === "simple" && <SimpleTable rows={props.rows} labels={props.labels} />}
        {props.kind === "image" && <ImageTable rows={props.rows} labels={props.labels} />}
      </div>
    </section>
  );
}

function TextTable({ rows, labels }: { rows: DisplayTextModel[]; labels: PricingLabels }) {
  return (
    <div className="overflow-x-auto">
      <table className="mobile-record-table w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">{labels.model}</th>
            <th className="px-4 py-3 font-medium">{labels.input}</th>
            <th className="px-4 py-3 font-medium">{labels.output}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row.model} className="hover:bg-neutral-50 dark:hover:bg-white/[0.04]">
              <td data-label={labels.model} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-950 dark:text-neutral-50">{row.model}</span>
                  {row.recommended && (
                    <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-white/15 dark:bg-white/10 dark:text-neutral-300">
                      {labels.recommended}
                    </span>
                  )}
                </div>
              </td>
              <td data-label={labels.input} className="px-4 py-3.5 font-mono text-sm text-neutral-800 dark:text-neutral-300">{row.input}</td>
              <td data-label={labels.output} className="px-4 py-3.5 font-mono text-sm text-neutral-800 dark:text-neutral-300">{row.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ rows, labels }: { rows: DisplaySimpleModel[]; labels: PricingLabels }) {
  return (
    <div className="overflow-x-auto">
      <table className="mobile-record-table w-full min-w-[360px] text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">{labels.model}</th>
            <th className="px-4 py-3 font-medium">{labels.price}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row.model} className="hover:bg-neutral-50 dark:hover:bg-white/[0.04]">
              <td data-label={labels.model} className="px-4 py-3.5 font-medium text-neutral-950 dark:text-neutral-50">{row.model}</td>
              <td data-label={labels.price} className="px-4 py-3.5 font-mono text-sm text-neutral-800 dark:text-neutral-300">{row.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageTable({ rows, labels }: { rows: DisplayImageModel[]; labels: PricingLabels }) {
  return (
    <div className="overflow-x-auto">
      <table className="mobile-record-table w-full min-w-[360px] text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">{labels.imageSize}</th>
            <th className="px-4 py-3 font-medium">{labels.price}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row.size} className="hover:bg-neutral-50 dark:hover:bg-white/[0.04]">
              <td data-label={labels.imageSize} className="px-4 py-3.5 font-medium text-neutral-950 dark:text-neutral-50">{row.size}</td>
              <td data-label={labels.price} className="px-4 py-3.5 font-mono text-sm text-neutral-800 dark:text-neutral-300">{row.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
