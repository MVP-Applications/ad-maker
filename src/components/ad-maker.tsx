"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  GlobeIcon,
  PencilIcon,
  UploadIcon,
  RefreshIcon,
  XIcon,
} from "@/components/icons";
import {
  AD_COMPANY_CONCEPT_COUNT,
  AD_PRODUCT_CONCEPT_MAX,
  AD_RUN_LIMITS,
  AD_RUN_MAX_SIZE,
  AD_RUN_MIN_SIZE,
  productKey,
  type AdBrief,
  type Product,
} from "@/lib/ad-run";
import {
  brandColorToRgb,
  expandBrandColorHex,
  parseColorInput,
  type BrandColor,
} from "@/lib/brand-color";
import { describeColor } from "@/lib/generate/colors";
import { directionByKey } from "@/lib/generate/directions";
import {
  findFont,
  FONT_CATEGORY_LABEL,
  fontPreviewStack,
  googleFontHref,
  OFFERED_FONTS,
} from "@/lib/fonts";
import { languageName, OFFERED_LANGUAGES } from "@/lib/languages";
import { researchStage } from "@/lib/research-stages";
import { imageModelById, takesProductPhoto } from "@/lib/generate/models";
import type { AdMakerController, AdSlot } from "@/hooks/use-ad-maker";

type IdleController = Extract<AdMakerController, { phase: "idle" }>;
type BriefController = Extract<AdMakerController, { phase: "brief" }>;
type CatalogController = Extract<AdMakerController, { phase: "catalog" }>;
type DnaController = Extract<AdMakerController, { phase: "dna" }>;
type ComposeController = Extract<AdMakerController, { phase: "compose" }>;
/** The gallery and nothing else: every earlier phase now has its own screen. */
type WorkspaceController = Extract<
  AdMakerController,
  { phase: "generating" } | { phase: "done" }
>;

const EXAMPLE_DOMAINS = ["stripe.com", "linear.app", "notion.so", "vercel.com"];

export function AdMaker({ s }: { s: AdMakerController }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background font-sans antialiased">
      <div className="relative z-10 flex flex-1 flex-col pt-6">
        {s.phase === "idle" ? (
          <Hero s={s} />
        ) : s.phase === "brief" ? (
          <Researching s={s} />
        ) : s.phase === "catalog" ? (
          <Catalog s={s} />
        ) : s.phase === "dna" ? (
          <BrandDna s={s} />
        ) : s.phase === "compose" ? (
          <Compose s={s} />
        ) : (
          <Workspace s={s} />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── idle: the hero ────────────────────────── */

function Hero({ s }: { s: IdleController }) {
  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Static glow on mobile; the drifting-blob animation is desktop-only (GPU cost). */}
        <div className="absolute left-1/2 top-[-6rem] h-72 w-72 -translate-x-1/2 rounded-full bg-brand-purple/30 blur-[120px] sm:animate-blob" />
        <div className="absolute right-[8%] top-24 h-64 w-64 rounded-full bg-brand-purple/20 blur-[120px] sm:animate-blob [animation-delay:-6s]" />
        <div className="absolute left-[6%] top-40 h-56 w-56 rounded-full bg-brand-blue/20 blur-[120px] sm:animate-blob [animation-delay:-3s]" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 text-center">
        <p className="mb-5 -skew-x-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground animate-fade-up">
          Pulls brand data from public sites
        </p>
        <h1 className="text-gradient text-4xl font-semibold leading-[1.05] tracking-tight animate-fade-up [animation-delay:60ms] min-[430px]:text-5xl sm:text-[4.25rem]">
          On-brand ads,
          <br />
          generated in seconds.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-[16px] leading-relaxed text-muted-foreground animate-fade-up [animation-delay:120ms]">
          Paste a public domain. We pull the logo, colors, style, and products, then
          generate {AD_RUN_MIN_SIZE}–{AD_RUN_MAX_SIZE} ready-to-ship ads: three
          for the company and up to three for its products.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (s.domain.trim()) void s.start(s.domain);
          }}
          className="mt-8 w-full max-w-lg animate-fade-up [animation-delay:180ms]"
        >
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-1.5 shadow-[0_8px_60px_-16px_rgba(112,0,255,0.55)] ring-1 ring-border backdrop-blur focus-within:ring-2 focus-within:ring-primary sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="pl-3 text-muted-foreground">
                <GlobeIcon />
              </span>
              <input
                type="text"
                value={s.domain}
                onChange={(e) => s.setDomain(e.target.value)}
                placeholder="Enter your brand URL, e.g. stripe.com"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm"
              />
            </div>
            {/* The label is carried by aria-label rather than on screen: the
                arrow alone has to say "go", so the accessible name is the only
                place left that can say what going does. */}
            <button
              type="submit"
              disabled={!s.domain.trim()}
              aria-label={`Generate ${AD_RUN_MIN_SIZE}–${AD_RUN_MAX_SIZE} ads`}
              title={`Generate ${AD_RUN_MIN_SIZE}–${AD_RUN_MAX_SIZE} ads`}
              className="btn-gradient size-11 shrink-0 justify-center rounded-full !p-0 transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              <ArrowRightIcon />
            </button>
          </div>
          {s.error && <p className="mt-2 text-xs text-red-500">{s.error}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Try:</span>
            {EXAMPLE_DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  s.setDomain(d);
                  void s.start(d);
                }}
                className="rounded-full bg-card px-2.5 py-1 font-medium text-muted-foreground ring-1 ring-border transition hover:bg-white/10 hover:text-foreground"
              >
                {d}
              </button>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}

/* ─────────────────── reading the site: the wait itself ─────────────────── */

function Researching({ s }: { s: BriefController }) {
  const stage = researchStage(s.elapsed);

  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-6rem] h-72 w-72 -translate-x-1/2 rounded-full bg-brand-purple/30 blur-[120px] sm:animate-blob" />
        <div className="absolute right-[8%] top-24 h-64 w-64 rounded-full bg-brand-blue/20 blur-[120px] sm:animate-blob [animation-delay:-4s]" />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 text-center">
        <div className="w-full rounded-3xl border border-border bg-card p-8 shadow-card animate-fade-up">
          <h1 className="text-gradient text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Reading your brand
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-balance text-[14px] leading-relaxed text-muted-foreground">
            We&apos;re pulling the logo, colours, type and product catalogue
            straight off your site. This usually takes under a minute.
          </p>

          <div
            aria-live="polite"
            className="mt-7 inline-flex items-center gap-2.5 rounded-full bg-background px-4 py-2.5 text-[13px] font-medium text-foreground ring-1 ring-border"
          >
            <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {stage}
          </div>

          <div className="mt-7 flex items-center justify-center gap-2 border-t border-border pt-5 text-[13px] text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?sz=64&domain=${s.submittedDomain}`}
              alt=""
              className="size-4 rounded"
            />
            {s.submittedDomain}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 text-[12px] text-muted-foreground animate-fade-up [animation-delay:120ms]">
          <span className="font-mono tabular-nums">{fmtElapsed(s.elapsed)}</span>
          <button onClick={s.reset} className="btn-secondary h-8 px-3 text-[12px]">
            <CloseIcon /> Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

/* ────────────────── the catalogue, for keeping or cutting ────────────────── */

const priceLabel = (product: Product): string | null => {
  if (product.price === null) return null;
  const amount = product.price.toFixed(2);
  return product.currency ? `${product.currency} ${amount}` : amount;
};

function ProductCard({
  product,
  checked,
  onToggle,
}: {
  product: Product;
  checked: boolean;
  onToggle: () => void;
}) {
  const price = priceLabel(product);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`group relative overflow-hidden rounded-2xl border text-left transition ${
        checked
          ? "border-primary/70 bg-card ring-2 ring-primary/40"
          : "border-border bg-card opacity-60 hover:opacity-100"
      }`}
    >
      <div className="relative aspect-square bg-brand-dark">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[11px] text-muted-foreground">
            no photo
          </span>
        )}

        <span
          aria-hidden
          className={`absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full ring-1 transition ${
            checked
              ? "bg-primary text-white ring-primary"
              : "bg-black/50 text-transparent ring-white/40"
          }`}
        >
          <CheckIcon />
        </span>

        {product.flagship && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-brand-washed ring-1 ring-primary/40">
            Suggested
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-[12px] font-semibold text-foreground">
          {product.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {price ?? "—"}
        </p>
      </div>
    </button>
  );
}

function Catalog({ s }: { s: CatalogController }) {
  const total = s.products.length;
  // A shop names far more than it describes, and only a described Product can
  // become an ad. Keeping the undescribed ones is fine; keeping only them is not.
  const blocked = s.advertisableCount === 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-8 pb-28">
      {/* The brand sits to one side and the heading stays centred on the page,
          so the two side columns are equal-basis and the right one is empty:
          it exists to balance the left, which is what keeps the title in the
          middle of the screen rather than the middle of what is left over. */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex w-full min-w-0 sm:flex-1">
          <BrandIdentity
            brief={s.brief}
            cleanDomain={s.submittedDomain}
            onReset={s.reset}
          />
        </div>

        <div className="animate-fade-up shrink-0 text-center [animation-delay:60ms]">
          <h1 className="text-gradient text-3xl font-semibold tracking-tight">
            Your products
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            We found {total} on {s.submittedDomain}. Keep the ones you want to
            advertise.
          </p>
        </div>

        <div aria-hidden className="hidden sm:block sm:flex-1" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground">
          {s.selectedCount} of {total} selected
        </p>
        <div className="flex items-center gap-2">
          <button onClick={s.selectAll} className="btn-secondary text-[12px]">
            Select all
          </button>
          <button onClick={s.deselectAll} className="btn-secondary text-[12px]">
            Deselect all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 min-[560px]:grid-cols-3 lg:grid-cols-4">
        {s.products.map((product) => (
          <ProductCard
            key={product.name}
            product={product}
            checked={s.selected.has(product.name.trim().toLocaleLowerCase())}
            onToggle={() => s.toggleProduct(product.name)}
          />
        ))}
      </div>

      {/* Kept in view: the list runs to hundreds, and the way forward should not
          be somewhere at the bottom of it. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <p className="text-[12px] text-muted-foreground">
            {s.selectedCount === 0
              ? "Select at least one product to continue"
              : blocked
                ? "None of these say what they are — keep one with a description to advertise"
                : `${s.selectedCount} kept · ${s.advertisableCount} can be advertised`}
          </p>
          <button
            onClick={s.confirmSelection}
            disabled={blocked}
            className="btn-gradient disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue with {s.selectedCount} →
          </button>
        </div>
      </div>
    </main>
  );
}

/* ─────────────── what the extract found about the brand ─────────────── */

function DnaCard({
  label,
  children,
  className = "",
  onEdit,
  editLabel,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Given only for a card that has something to correct. */
  onEdit?: () => void;
  editLabel?: string;
}) {
  // min-w-0/min-h-0 and overflow-hidden together: a grid item's default
  // min-size is its content, so without them a long name or a row of
  // thumbnails widens the cell and spills past the card's own border.
  const base =
    "group relative flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 transition-colors";

  if (!onEdit) {
    return (
      <div className={`${base} ${className}`}>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        <p className="mt-2 shrink-0 text-[11px] text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={editLabel}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className={`${base} cursor-pointer hover:border-primary/60 hover:bg-white/[0.03] focus:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary ${className}`}
    >
      {/* Always present, faint until the card is reached for: the affordance
          has to be findable without the hover that reveals it. */}
      <span className="pointer-events-none absolute right-2 top-2 grid size-6 place-items-center rounded-lg bg-white/[0.06] text-muted-foreground opacity-40 ring-1 ring-border transition group-hover:bg-primary group-hover:text-white group-hover:opacity-100">
        <PencilIcon className="size-3" />
      </span>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
      <p className="mt-2 shrink-0 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * The editing surface for one card.
 *
 * Edits are made against a draft and only reach the run on Save, so a field
 * opened by mistake costs nothing and Escape is always safe.
 */
function EditSheet({
  title,
  hint,
  onClose,
  onSave,
  live = false,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  onSave: () => void;
  /** True when edits already took effect, so there is nothing to cancel. */
  live?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center p-5"
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="animate-sheet-in relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 space-y-4">{children}</div>

        <div className="mt-6 flex justify-end gap-2">
          {!live && (
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-[13px]"
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn-gradient text-[13px]">
            {live ? "Done" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Every photograph the extract carries, shown as photographs.
 *
 * These are not a separate choice: the hero shot comes off the site and the
 * rest are the kept Products' own images, so what is here follows from the
 * Products sheet. It is a gallery rather than a picker for that reason —
 * a checkbox here would be a second, disagreeing answer to one question.
 */
function ImagesSheet({
  images,
  heroImageUrl,
}: {
  images: readonly string[];
  heroImageUrl: string | null;
}) {
  const [broken, setBroken] = useState<readonly string[]>([]);
  const usable = images.filter((url) => !broken.includes(url));

  return (
    <div>
      <p className="mb-2 text-[12px] text-muted-foreground">
        {usable.length} image{usable.length === 1 ? "" : "s"} · the hero shot,
        then each kept Product&apos;s own photograph.
      </p>
      <div className="grid max-h-[46vh] grid-cols-4 gap-2 overflow-y-auto pr-1">
        {usable.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            title="Open the full image"
            className="logo-light relative aspect-square overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              onError={() => setBroken((was) => [...was, url])}
              className="size-full object-cover"
            />
            {url === heroImageUrl && (
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white">
                Hero
              </span>
            )}
          </a>
        ))}
        {usable.length === 0 && (
          <p className="col-span-4 text-[12px] text-muted-foreground">
            None found.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Keep or add Products without leaving the Brief.
 *
 * The whole catalogue is listed rather than only what was kept, because the
 * question asked here is "add more", and a list of what you already have
 * cannot answer it. Kept entries are checked and sorted first, so the ones
 * the run will use stay together at the top as the selection changes.
 */
function ProductsSheet({
  catalogue,
  kept,
  onToggle,
}: {
  catalogue: readonly Product[];
  kept: readonly Product[];
  onToggle: (name: string) => void;
}) {
  const keptKeys = new Set(kept.map((product) => productKey(product.name)));
  const ordered = [
    ...catalogue.filter((p) => keptKeys.has(productKey(p.name))),
    ...catalogue.filter((p) => !keptKeys.has(productKey(p.name))),
  ];

  return (
    <div>
      <p className="mb-2 text-[12px] text-muted-foreground">
        {kept.length} of {catalogue.length} kept · an ad can only be written
        about a Product the shop describes.
      </p>
      <div className="max-h-[46vh] space-y-1 overflow-y-auto pr-1">
        {ordered.map((product) => {
          const checked = keptKeys.has(productKey(product.name));
          const advertisable = Boolean(product.description);
          return (
            <button
              key={product.name}
              type="button"
              onClick={() => onToggle(product.name)}
              className={`flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition ${
                checked
                  ? "bg-primary/10 ring-1 ring-primary/40"
                  : "ring-1 ring-transparent hover:bg-white/[0.04]"
              }`}
            >
              <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-brand-dark ring-1 ring-border">
                {product.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={product.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-foreground">
                  {product.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {advertisable
                    ? product.description
                    : "No description — cannot be advertised"}
                </span>
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${
                  checked
                    ? "bg-primary text-white"
                    : "ring-1 ring-border"
                }`}
              >
                {checked && <CheckIcon className="size-3" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Load a Google-served face so the specimen is the face itself.
 *
 * The stylesheet is left in the document once fetched rather than removed on
 * change: the reader is comparing faces, and tearing each one out as they move
 * to the next re-downloads everything they scroll back to.
 */
function useGoogleFont(family: string | null) {
  useEffect(() => {
    const href = googleFontHref(family);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [family]);
}

/**
 * The brand's typeface, shown as a specimen rather than named.
 *
 * The preview is set in the brand's own name because that is where the choice
 * shows: a face is picked for how a wordmark sits in it. A family the reader
 * does not have installed falls back to its own generic, so the specimen is
 * indicative rather than exact — which is all it can honestly be, given the
 * ad is drawn by a model rather than by this browser.
 */
function FontPicker({
  family,
  brandName,
  onChange,
}: {
  family: string | null;
  brandName: string;
  onChange: (family: string | null) => void;
}) {
  const known = findFont(family);
  useGoogleFont(family);

  return (
    <div className="space-y-3">
      <div
        className="grid min-h-[5.5rem] place-items-center overflow-hidden rounded-xl border border-border bg-white/[0.03] px-4"
        style={{ fontFamily: fontPreviewStack(family) }}
      >
        <span className="truncate text-3xl font-semibold text-foreground">
          {brandName || "Your brand"}
        </span>
      </div>

      <Field
        label="Typeface"
        hint={
          family && !known
            ? "Read off the site. It is not in the list, and that is fine."
            : `${OFFERED_FONTS.length} faces — the preview above is the real one.`
        }
      >
        <select
          value={known ? (family ?? "") : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="input cursor-pointer"
        >
          <option value="">
            {family && !known ? `${family} (from the site)` : "Not stated"}
          </option>
          {(
            [
              "sans-serif",
              "serif",
              "display",
              "monospace",
              "handwriting",
            ] as const
          ).map((category) => (
            <optgroup key={category} label={FONT_CATEGORY_LABEL[category]}>
              {OFFERED_FONTS.filter((font) => font.category === category).map(
                (font) => (
                  <option key={font.name} value={font.name}>
                    {font.name}
                    {font.google ? "" : " · needs installing"}
                  </option>
                ),
              )}
            </optgroup>
          ))}
        </select>
      </Field>
    </div>
  );
}

/**
 * The languages the site publishes itself in.
 *
 * The first is the primary one and the card shows it, so the order is part of
 * the answer rather than incidental — a chip can be promoted without being
 * removed and re-added. Tags the extract found that the picker does not offer
 * are still listed and still removable: the site's own answer outranks this
 * list, which exists to save typing rather than to bound what is true.
 */
function LanguagePicker({
  languages,
  onChange,
}: {
  languages: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const chosen = new Set(languages);
  const available = OFFERED_LANGUAGES.filter((tag) => !chosen.has(tag));
  const full = languages.length >= AD_RUN_LIMITS.languages;

  const promote = (tag: string) =>
    onChange([tag, ...languages.filter((t) => t !== tag)]);

  return (
    <div className="space-y-3">
      <Field
        label="Languages"
        hint={
          languages.length
            ? "The first is the primary one. Click another to promote it."
            : "None chosen — the ads will not state a language."
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {languages.map((tag, index) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1.5 rounded-lg py-1 pl-2 pr-1 text-[12px] ring-1 ${
                index === 0
                  ? "bg-primary/15 text-foreground ring-primary/50"
                  : "bg-white/[0.04] text-muted-foreground ring-border"
              }`}
            >
              <button
                type="button"
                onClick={() => promote(tag)}
                disabled={index === 0}
                title={index === 0 ? "Primary language" : "Make primary"}
                className="disabled:cursor-default"
              >
                <span className="font-semibold uppercase">{tag}</span>{" "}
                {languageName(tag)}
              </button>
              <button
                type="button"
                onClick={() => onChange(languages.filter((t) => t !== tag))}
                aria-label={`Remove ${languageName(tag)}`}
                title="Remove"
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-red-500/20 hover:text-red-400"
              >
                <CloseIcon className="size-3" />
              </button>
            </span>
          ))}
          {languages.length === 0 && (
            <span className="text-[12px] text-muted-foreground">
              None chosen
            </span>
          )}
        </div>
      </Field>

      <Field
        label="Add a language"
        hint={
          full
            ? `That is the most a Brief carries (${AD_RUN_LIMITS.languages}).`
            : undefined
        }
      >
        <select
          value=""
          disabled={full || available.length === 0}
          onChange={(e) => {
            if (e.target.value) onChange([...languages, e.target.value]);
          }}
          className="input cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {available.length === 0 ? "All languages added" : "Choose a language…"}
          </option>
          {available.map((tag) => (
            <option key={tag} value={tag}>
              {languageName(tag)} ({tag})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/**
 * The palette, and the two colours an ad is actually told to use.
 *
 * Swatches are the subject here rather than the text fields: the two prompt
 * colours are phrases like "vivid pink", and asking someone to invent that
 * phrasing is asking them to guess at the model's vocabulary. Choosing a
 * swatch names it with the same function the extract used, so a hand-picked
 * pair reads to the model exactly like an extracted one. The words stay
 * editable underneath for the brand that has its own name for a colour.
 */
function PaletteEditor({
  colors,
  colorA,
  colorB,
  onChange,
}: {
  colors: readonly BrandColor[];
  colorA: string;
  colorB: string;
  onChange: (patch: Partial<AdBrief>) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);

  const current = colors[selected] ?? null;
  const full = current ? (expandBrandColorHex(current.hex) ?? "#000000") : null;

  const setHex = (hex: string) =>
    onChange({
      colors: colors.map((c, i) => (i === selected ? { ...c, hex } : c)),
    });

  const add = () => {
    if (colors.length >= AD_RUN_LIMITS.palette) return;
    onChange({ colors: [...colors, { hex: "#7c3aed", name: null }] });
    setSelected(colors.length);
    setTyped(null);
  };

  const remove = () => {
    if (!current) return;
    onChange({ colors: colors.filter((_, i) => i !== selected) });
    setSelected((was) => Math.max(0, was - 1));
    setTyped(null);
  };

  return (
    <div className="space-y-3">
      <Field label="Palette" hint="Pick a swatch to edit it, or add your own.">
        <div className="flex flex-wrap gap-2">
          {colors.map((color, index) => {
            const hex = expandBrandColorHex(color.hex) ?? "#000000";
            const phrase = describeColor(color.hex);
            const isA = phrase === colorA;
            const isB = phrase === colorB;
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setSelected(index);
                  setTyped(null);
                }}
                title={`${hex} · ${phrase}`}
                aria-label={`Colour ${index + 1}, ${phrase}`}
                aria-pressed={index === selected}
                className={`relative size-12 rounded-xl transition-transform hover:scale-105 ${
                  index === selected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                    : "ring-1 ring-border"
                }`}
                style={{ background: hex }}
              >
                {(isA || isB) && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-card">
                    {isA ? "A" : "B"}
                  </span>
                )}
              </button>
            );
          })}

          {colors.length < AD_RUN_LIMITS.palette && (
            <button
              type="button"
              onClick={add}
              aria-label="Add a colour"
              title="Add a colour"
              className="grid size-12 place-items-center rounded-xl border border-dashed border-border text-lg text-muted-foreground transition hover:border-primary hover:text-foreground"
            >
              +
            </button>
          )}
        </div>
      </Field>

      {current && full && (
        <div className="rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <label
              className="relative size-9 shrink-0 cursor-pointer rounded-lg ring-1 ring-border"
              style={{ background: full }}
              title="Open the colour picker"
            >
              <input
                type="color"
                value={full}
                aria-label="Colour picker"
                onChange={(e) => {
                  setHex(e.target.value);
                  setTyped(null);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>

            {/* Either notation: a guideline states one or the other, and
                converting between them by hand is the app's job. */}
            <input
              type="text"
              value={typed ?? full}
              aria-label="Colour value in hex or RGB"
              placeholder="#d6001c or rgb(214, 0, 28)"
              onChange={(e) => {
                setTyped(e.target.value);
                const parsed = parseColorInput(e.target.value);
                if (parsed) setHex(parsed);
              }}
              onBlur={() => setTyped(null)}
              className={`input flex-1 font-mono text-[12px] ${
                typed !== null && !parseColorInput(typed)
                  ? "border-red-500/60"
                  : ""
              }`}
            />

            <button
              type="button"
              onClick={remove}
              aria-label="Delete this colour"
              title="Delete this colour"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-red-500/15 hover:text-red-400"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {brandColorToRgb(current.hex)} · reads as{" "}
              <span className="text-foreground">{describeColor(current.hex)}</span>
            </span>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ colorA: describeColor(current.hex) })}
              className="btn-secondary flex-1 justify-center text-[12px]"
            >
              Use as first
            </button>
            <button
              type="button"
              onClick={() => onChange({ colorB: describeColor(current.hex) })}
              className="btn-secondary flex-1 justify-center text-[12px]"
            >
              Use as second
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ads use">
          <input
            type="text"
            value={colorA}
            maxLength={AD_RUN_LIMITS.promptColor}
            placeholder="charcoal"
            onChange={(e) => onChange({ colorA: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="and">
          <input
            type="text"
            value={colorB}
            maxLength={AD_RUN_LIMITS.promptColor}
            placeholder="off-white"
            onChange={(e) => onChange({ colorB: e.target.value })}
            className="input"
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * Upload a logo the extract could not read off the site.
 *
 * The file is stored by POST /api/logo and what comes back is a URL, because
 * a Brief carries a URL rather than bytes — the server fetches it later to
 * hand the mark to a model. Development only, and the button says so rather
 * than failing quietly against a deployment.
 */
function LogoUpload({
  onUploaded,
  disabled,
  setUploading,
  error,
  setError,
}: {
  onUploaded: (url: string) => void;
  disabled: boolean;
  setUploading: (busy: boolean) => void;
  error: string | null;
  setError: (message: string | null) => void;
}) {
  const send = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/logo", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Couldn't upload that image.");
        return;
      }
      onUploaded(payload.url);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground transition hover:border-primary hover:text-foreground ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <UploadIcon />
        {disabled ? "Uploading…" : "Or upload from your computer"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so choosing the same file twice still fires a change.
            e.target.value = "";
            if (file) void send(file);
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** One labelled control inside an [EditSheet]. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function Thumbnails({
  urls,
  total,
  alt,
}: {
  urls: readonly string[];
  total: number;
  alt: string;
}) {
  // A URL the extract carries is not a URL that loads: the hero shot is often
  // an SVG sprite or a hotlink the shop refuses, and a broken raster used to
  // reach this row as the browser's torn-page glyph. Drop those on error
  // rather than showing the reader a picture of a failure.
  const [broken, setBroken] = useState<readonly string[]>([]);
  const usable = urls.filter((url) => !broken.includes(url));
  const shown = usable.slice(0, 3);
  const rest = Math.max(0, total - broken.length - shown.length);

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {shown.map((url) => (
        <div
          key={url}
          className="size-11 shrink-0 overflow-hidden rounded-lg bg-brand-dark ring-1 ring-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            onError={() => setBroken((was) => [...was, url])}
            className="size-full object-cover"
          />
        </div>
      ))}
      {rest > 0 && (
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold text-foreground ring-1 ring-border">
          +{rest}
        </span>
      )}
      {shown.length === 0 && (
        <span className="truncate text-[12px] text-muted-foreground">
          None found
        </span>
      )}
    </div>
  );
}

/** Which card's sheet is open. */
type DnaField =
  | "logo"
  | "brand"
  | "type"
  | "language"
  | "colours"
  | "headline"
  | "products"
  | "images";

const SHEET_COPY: Record<DnaField, { title: string; hint: string }> = {
  logo: { title: "Logo", hint: "The image handed to models that accept one." },
  brand: { title: "Brand", hint: "The name printed on every ad." },
  type: { title: "Typography", hint: "The typeface the ads should echo." },
  language: { title: "Language", hint: "The language the ad copy is written in." },
  colours: { title: "Colours", hint: "The palette, and the two colours ads use." },
  headline: { title: "Headline", hint: "The brand's own words, in its own voice." },
  products: {
    title: "Products",
    hint: "Everything the shop sells. Keep the ones worth advertising.",
  },
  images: {
    title: "Images",
    hint: "Every photograph the extract carries, hero shot first.",
  },
};

function BrandDna({ s }: { s: DnaController }) {
  const b = s.brief;
  const primaryLanguage = b.languages[0] ?? "";

  const [editing, setEditing] = useState<DnaField | null>(null);
  // Edits are made against a copy so Cancel and Escape genuinely discard.
  const [draft, setDraft] = useState<AdBrief>(b);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Which field the logo preview sits on. Light by default and flipped by
  // hand: the mark's own colour cannot be read to decide it automatically.
  const [sheetTone, setLogoOverride] = useState<"light" | "dark">("light");
  // The card sets the brand's name in the face too, so it needs it loaded.
  useGoogleFont(b.fontFamily);

  const open = (field: DnaField) => {
    setDraft(b);
    setUploadError(null);
    setEditing(field);
  };
  const patch = (next: Partial<AdBrief>) =>
    setDraft((was) => ({ ...was, ...next }));
  const save = () => {
    s.editBrief(draft);
    setEditing(null);
  };

  return (
    // A fixed height rather than a flowing page: everything the extract found
    // has to be checkable at once, and a field that needs scrolling to reach
    // is a field that gets confirmed without being read.
    // Less the pt-6 the shell adds above every screen: this page claims the
    // viewport exactly, and 100dvh inside that padding overflows by its height.
    <main className="mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col px-5 pb-20 pt-3">
      <div className="animate-fade-up shrink-0 text-center">
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">
          Your brand
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Everything we read off {s.submittedDomain}.{" "}
          <span className="text-brand-washed">Click any field to correct it</span>{" "}
          before it reaches an ad.
        </p>
      </div>

      {/* 4x4 exactly: every cell is spoken for, so the varied card sizes still
          resolve into one rectangle instead of a ragged last row. */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 grid-rows-4 gap-2.5">
        <DnaCard
          label="Logo"
          className="col-span-2 row-span-2"
          onEdit={() => open("logo")}
          editLabel="Edit logo"
        >
          <div className="logo-light grid h-full min-h-0 place-items-center overflow-hidden rounded-xl p-4">
            {b.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={b.logoUrl}
                alt={`${b.brandName} logo`}
                className="logo-edge max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[12px] text-zinc-500">No logo found</span>
            )}
          </div>
        </DnaCard>

        <DnaCard
          label="Brand"
          className="col-span-2"
          onEdit={() => open("brand")}
          editLabel="Edit brand name"
        >
          <p className="truncate pr-8 text-xl font-semibold text-foreground">
            {b.brandName}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {b.domain}
          </p>
        </DnaCard>

        <DnaCard
          label="Typography"
          onEdit={() => open("type")}
          editLabel="Edit typography"
        >
          {/* The brand's own name, set in the face: a specimen says more about
              a typeface than its name does, and "Aa" says nothing at all. */}
          <p
            className="truncate pr-7 text-2xl font-semibold leading-tight text-foreground"
            style={{ fontFamily: fontPreviewStack(b.fontFamily) }}
          >
            {b.brandName}
          </p>
          <p className="mt-1.5 truncate text-[12px] text-muted-foreground">
            {b.fontFamily ?? "Not stated"}
          </p>
        </DnaCard>

        <DnaCard
          label="Language"
          onEdit={() => open("language")}
          editLabel="Edit language"
        >
          {primaryLanguage ? (
            <>
              {/* Three tags, then a count: the card is a quarter of the grid,
                  and the fourth chip is what starts wrapping it out of shape. */}
              <div className="flex flex-wrap items-center gap-1 pr-7">
                {b.languages.slice(0, 3).map((tag, index) => (
                  <span
                    key={tag}
                    title={languageName(tag)}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                      index === 0
                        ? "bg-primary/15 text-foreground ring-primary/40"
                        : "bg-muted text-muted-foreground ring-border"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
                {b.languages.length > 3 && (
                  <span
                    title={b.languages.slice(3).map(languageName).join(", ")}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border"
                  >
                    +{b.languages.length - 3}
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-[12px] text-foreground">
                {languageName(primaryLanguage)}
              </p>
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">Not stated</p>
          )}
        </DnaCard>

        <DnaCard
          label="Colours"
          className="col-span-2"
          onEdit={() => open("colours")}
          editLabel="Edit colours"
        >
          {b.colors.length > 0 ? (
            // flex-1 rather than a fixed size: the row is the width of the
            // card whether the site stated two colours or eight.
            <div className="flex gap-1.5 pr-9">
              {b.colors.slice(0, AD_RUN_LIMITS.palette).map((color, index) => (
                <span
                  key={`${index}-${color.hex}`}
                  title={`${color.name ?? "Colour"} · ${color.hex}`}
                  className="h-9 min-w-0 flex-1 rounded-lg ring-1 ring-border"
                  style={{ background: color.hex }}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">None found</p>
          )}
          <p className="mt-2 truncate text-[11px] text-muted-foreground">
            Ads use{" "}
            <span className="text-foreground">{b.colorA}</span> and{" "}
            <span className="text-foreground">{b.colorB}</span>
          </p>
        </DnaCard>

        <DnaCard
          label="Headline"
          className="col-span-2"
          onEdit={() => open("headline")}
          editLabel="Edit headline"
        >
          <p className="line-clamp-3 pr-8 text-[14px] leading-snug text-foreground">
            {b.headline || b.description || "Not stated"}
          </p>
        </DnaCard>

        <DnaCard
          label={`Products · ${s.products.length} kept`}
          className="col-span-2"
          onEdit={() => open("products")}
          editLabel="Choose which products are kept"
        >
          <Thumbnails
            urls={s.products.flatMap((p) => (p.imageUrl ? [p.imageUrl] : []))}
            total={s.products.length}
            alt=""
          />
        </DnaCard>

        <DnaCard
          label={`Images · ${s.images.length} found`}
          className="col-span-2"
          onEdit={() => open("images")}
          editLabel="See every image the extract carries"
        >
          <Thumbnails urls={s.images} total={s.images.length} alt="" />
        </DnaCard>
      </div>

      {editing && (
        <EditSheet
          title={SHEET_COPY[editing].title}
          hint={SHEET_COPY[editing].hint}
          onClose={() => setEditing(null)}
          onSave={
            editing === "products" || editing === "images"
              ? () => setEditing(null)
              : save
          }
          live={editing === "products" || editing === "images"}
        >
          {editing === "logo" && (
            <>
              <div
                className={`relative grid h-28 place-items-center overflow-hidden rounded-xl p-3 ${
                  sheetTone === "dark" ? "logo-dark" : "logo-light"
                }`}
              >
                {draft.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={draft.logoUrl}
                    alt=""
                    className="logo-edge max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[12px] text-zinc-500">No logo</span>
                )}

                {/* The field is chosen from the mark, and the mark is not
                    always readable — this is how that gets overruled. */}
                <button
                  type="button"
                  onClick={() =>
                    setLogoOverride(sheetTone === "dark" ? "light" : "dark")
                  }
                  aria-label="Show the logo on the other background"
                  title="Show the logo on the other background"
                  className={`absolute bottom-1.5 right-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    sheetTone === "dark"
                      ? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                      : "bg-black/[0.06] text-zinc-500 hover:bg-black/10 hover:text-zinc-800"
                  }`}
                >
                  {sheetTone === "dark" ? "On light" : "On dark"}
                </button>
              </div>

              <Field
                label="Logo image URL"
                hint="A public PNG, JPG or WebP. Leave empty for no logo."
              >
                <input
                  type="text"
                  value={draft.logoUrl ?? ""}
                  maxLength={AD_RUN_LIMITS.logoUrl}
                  placeholder="https://example.com/logo.png"
                  onChange={(e) =>
                    patch({ logoUrl: e.target.value.trim() || null })
                  }
                  className="input"
                />
              </Field>

              <LogoUpload
                onUploaded={(url) => patch({ logoUrl: url })}
                disabled={uploading}
                setUploading={setUploading}
                error={uploadError}
                setError={setUploadError}
              />
            </>
          )}

          {editing === "brand" && (
            <>
              <Field label="Brand name">
                <input
                  type="text"
                  autoFocus
                  value={draft.brandName}
                  maxLength={AD_RUN_LIMITS.brandName}
                  onChange={(e) => patch({ brandName: e.target.value })}
                  className="input"
                />
              </Field>
              <Field
                label="Domain"
                hint="Fixed for this run — use New brand to read a different site."
              >
                <input
                  type="text"
                  value={draft.domain}
                  disabled
                  className="input cursor-not-allowed opacity-60"
                />
              </Field>
            </>
          )}

          {editing === "type" && (
            <FontPicker
              family={draft.fontFamily}
              brandName={draft.brandName}
              onChange={(fontFamily) => patch({ fontFamily })}
            />
          )}

          {editing === "language" && (
            <LanguagePicker
              languages={draft.languages}
              onChange={(languages) => patch({ languages })}
            />
          )}

          {editing === "colours" && (
            <PaletteEditor
              colors={draft.colors}
              colorA={draft.colorA}
              colorB={draft.colorB}
              onChange={patch}
            />
          )}

          {editing === "products" && (
            <ProductsSheet
              catalogue={s.catalogue}
              kept={s.products}
              onToggle={s.toggleProduct}
            />
          )}

          {editing === "images" && (
            <ImagesSheet images={s.images} heroImageUrl={b.heroImageUrl} />
          )}

          {editing === "headline" && (
            <Field
              label="Headline"
              hint="The brand's own line, not ad copy — that gets written later."
            >
              <textarea
                autoFocus
                rows={3}
                value={draft.headline}
                maxLength={AD_RUN_LIMITS.brandHeadline}
                placeholder={draft.description || "Not stated"}
                onChange={(e) => patch({ headline: e.target.value })}
                className="input resize-none"
              />
            </Field>
          )}
        </EditSheet>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3.5">
          <button onClick={s.back} className="btn-secondary text-[13px]">
            ← Back to products
          </button>
          <button onClick={s.confirmBrand} className="btn-gradient">
            Continue →
          </button>
        </div>
      </div>
    </main>
  );
}

/* ──────────── brief read, nothing decided: the creative form ──────────── */

/**
 * Where the run waits for its choices. Only one is offered so far — whether to
 * make the run at all — so this screen states what the Ad Run would be rather
 * than asking anything. The selectors replace that statement.
 */
function Compose({ s }: { s: ComposeController }) {
  const advertised = s.products.slice(0, AD_PRODUCT_CONCEPT_MAX);
  const total = AD_COMPANY_CONCEPT_COUNT + advertised.length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-8">
      <BrandBar
        brief={s.brief}
        cleanDomain={s.submittedDomain}
        onReset={s.reset}
      />

      <section className="animate-fade-up rounded-2xl border border-border bg-card p-5 [animation-delay:80ms]">
        <h2 className="text-[15px] font-semibold text-foreground">
          Ready to generate {total} ads
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {AD_COMPANY_CONCEPT_COUNT} for {s.brief.brandName} itself, plus one for
          each product below.
        </p>

        <ul className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {advertised.map((product) => (
            <li
              key={product.name}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-dark ring-1 ring-border">
                {product.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">no photo</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {product.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {product.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {s.products.length > advertised.length && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {s.products.length - advertised.length} more product
            {s.products.length - advertised.length === 1 ? "" : "s"} found on
            this site — choosing between them comes next.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void s.generate()}
            disabled={s.planning}
            className="btn-gradient disabled:cursor-not-allowed disabled:opacity-60"
          >
            {s.planning ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                Planning…
              </>
            ) : (
              <>✨ Generate {total} Ads</>
            )}
          </button>
          <button onClick={s.reset} className="btn-secondary text-[13px]">
            <RefreshIcon /> Try another brand
          </button>
        </div>

        {s.error && <p className="mt-3 text-xs text-red-500">{s.error}</p>}
      </section>
    </main>
  );
}

/* ─────────────── after submit: the same page, morphed ─────────────── */

const fmtElapsed = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

function Shimmer() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </span>
  );
}

function Workspace({ s }: { s: WorkspaceController }) {
  const cleanDomain = s.submittedDomain;
  const generating = s.phase === "generating";
  const total = s.slots.length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-8">
      <BrandBar brief={s.brief} cleanDomain={cleanDomain} onReset={s.reset} />

      {generating && (
        <div className="animate-fade-up rounded-2xl border border-border bg-card px-4 py-3.5 [animation-delay:80ms]">
          <div className="flex items-center gap-3">
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">
                Painting {total} on-brand ads
              </p>
              <p className="text-[11px] text-muted-foreground">
                Each ad lands the moment its model finishes · usually 1–3 min ·
                keep this tab open
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                {fmtElapsed(s.elapsed)}
              </span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-brand-washed ring-1 ring-primary/30">
                {s.doneCount}/{total}
              </span>
            </div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-purple transition-all duration-700"
              style={{ width: `${Math.max(6, (s.doneCount / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {s.slots.map((slot, i) => (
          <AdCard
            key={`${slot.concept.model}:${slot.concept.key}:${slot.concept.subject.kind}:${i}`}
            slot={slot}
            index={i}
            onRetry={() => s.retrySlot(i)}
            onDownload={() => s.downloadAd(i)}
          />
        ))}
      </div>

      {s.phase === "done" && (
        <div className="animate-fade-up flex flex-col items-center gap-3 pt-2">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {s.doneCount > 0 && (
              <button onClick={s.downloadAll} className="btn-dark">
                <DownloadIcon /> Download all {s.doneCount}
              </button>
            )}
            {s.doneCount > 0 && (
              <button
                onClick={() => void s.shareToX()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-black px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-zinc-800"
              >
                <XIcon /> Share on X
              </button>
            )}
            <button onClick={s.reset} className="btn-secondary text-[13px]">
              <RefreshIcon /> Try another brand
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Every ad is a 1:1 image — ready for feeds, decks, and campaigns.
          </p>
        </div>
      )}
    </main>
  );
}

/**
 * The brand, stated once beside the catalogue it produced.
 *
 * The Catalog asks one question — which of these to advertise — so the brand
 * only has to say who is asking. The palette and positioning the full BrandBar
 * carries answer a question nobody is being asked here, and the swatches in
 * particular pull the eye away from the product photographs that matter. Only
 * "Start over" survives: it is the one control on this screen that the header
 * alone provides a way to reach.
 */
function BrandIdentity({
  brief: b,
  cleanDomain,
  onReset,
}: {
  /** Null only while the extract is still running and no brand is known yet. */
  brief: AdBrief | null;
  cleanDomain: string;
  onReset: () => void;
}) {
  const lines = [b?.description, b?.mood].filter(Boolean) as string[];

  return (
    <div className="group animate-fade-up flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pr-3 shadow-card transition-colors hover:border-primary/40 sm:w-auto sm:max-w-[290px]">
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-dark p-2 ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            b?.logoUrl ??
            `https://www.google.com/s2/favicons?sz=64&domain=${cleanDomain}`
          }
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
          {b?.brandName ?? cleanDomain}
        </p>
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <p
              key={i}
              className={`mt-1 truncate text-[11.5px] leading-tight ${
                i === 0 ? "text-muted-foreground" : "text-brand-washed"
              }`}
            >
              {line}
            </p>
          ))
        ) : (
          <p className="mt-1 truncate text-[11.5px] leading-tight text-muted-foreground">
            {b ? b.domain : "Extracting brand…"}
          </p>
        )}
      </div>

      <button
        onClick={onReset}
        aria-label="Start over"
        title="Start over"
        className="btn-secondary size-9 shrink-0 justify-center px-0"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

function BrandBar({
  brief: b,
  cleanDomain,
  onReset,
}: {
  /** Null only while the extract is still running and no brand is known yet. */
  brief: AdBrief | null;
  cleanDomain: string;
  onReset: () => void;
}) {
  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:gap-4">
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-dark p-2 ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              b?.logoUrl ??
              `https://www.google.com/s2/favicons?sz=64&domain=${cleanDomain}`
            }
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {b?.brandName ?? cleanDomain}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {b ? b.description || b.domain : "Extracting brand…"}
          </p>
        </div>

        {b && b.colors.length > 0 && (
          <div className="flex items-center -space-x-1 animate-fade-up">
            {b.colors.slice(0, 6).map((c, i) => (
              <span
                key={`${c.hex}-${i}`}
                className="size-5 rounded-full ring-2 ring-card"
                style={{ background: c.hex }}
                title={c.hex}
              />
            ))}
          </div>
        )}
        {b?.industry && (
          <span className="hidden items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-brand-washed ring-1 ring-primary/40 md:inline-flex">
            <BoltIcon /> {b.industry.split(" · ")[0]}
          </span>
        )}

        <button
          onClick={onReset}
          aria-label="Start over"
          className="btn-secondary h-9 shrink-0 px-3 text-[12px]"
        >
          <RefreshIcon /> New brand
        </button>
      </div>
      {b?.mood && (
        <div className="border-t border-border px-4 py-2">
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="font-semibold text-brand-washed">Visual mood</span>{" "}
            · {b.mood}
          </p>
        </div>
      )}
    </div>
  );
}

function AdCard({
  slot,
  index,
  onRetry,
  onDownload,
}: {
  slot: AdSlot;
  index: number;
  onRetry: () => void;
  onDownload: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const c = slot.concept;
  const directionLabel = directionByKey(c.key)?.label ?? c.key;
  const modelName = imageModelById(c.model)?.displayName ?? c.model;
  const productName = c.subject.kind === "product" ? c.subject.name : null;
  const sourceImage = c.subject.kind === "product" ? c.subject.imageUrl : null;
  const model = imageModelById(c.model);
  const usedAsReference =
    sourceImage !== null && model !== undefined && takesProductPhoto(model);
  const cardTitle = productName ?? directionLabel;
  const subjectLabel = productName ? `Product · ${directionLabel}` : "Company";
  const imageAlt = productName
    ? `${productName} product ad in the ${directionLabel} creative direction`
    : `Company ad in the ${directionLabel} creative direction`;

  return (
    <div
      className="group animate-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {cardTitle}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {subjectLabel} · “{c.headline}”
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {modelName}
        </span>
      </div>

      <div className="relative aspect-square">
        {slot.status === "done" && slot.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.url}
              alt={imageAlt}
              onLoad={() => setLoaded(true)}
              className={`size-full object-cover transition-all duration-700 ${loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.03] opacity-0 blur-md"}`}
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/60 to-transparent p-3 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button
                onClick={onDownload}
                className="btn-dark px-3 py-1.5 text-[12px]"
              >
                <DownloadIcon /> Download
              </button>
            </div>
          </>
        ) : slot.status === "error" ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-white/[0.02] p-6 text-center">
            <p className="text-[13px] font-semibold text-foreground">
              This one didn&apos;t render
            </p>
            <p className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
              The model hiccuped. Retry this slot without changing your other
              ads.
            </p>
            <button
              onClick={onRetry}
              className="btn-secondary px-3 py-1.5 text-[12px]"
            >
              <RefreshIcon /> Retry
            </button>
          </div>
        ) : (
          <div className="relative size-full">
            <Shimmer />
            <div className="absolute inset-0 grid place-items-center">
              <span className="size-5 animate-spin rounded-full border-2 border-primary/70 border-t-transparent" />
            </div>
          </div>
        )}
      </div>

      {/* The shop's own photograph of this product. Shown so the ad above can be
          judged against the real article instead of taken on trust — and it says
          whether this model was actually given it, since only some accept one. */}
      {sourceImage ? (
        <div className="flex items-start gap-2.5 border-t border-border px-3 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceImage}
            alt={`${productName} as photographed on the brand's own site`}
            className="size-10 shrink-0 rounded-md border border-border bg-white object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {usedAsReference
                ? "Real product · sent as reference"
                : "Real product · not sent (model takes text only)"}
            </p>
            <a
              href={sourceImage}
              target="_blank"
              rel="noreferrer noopener"
              title={sourceImage}
              className="block truncate font-mono text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              {sourceImage}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
