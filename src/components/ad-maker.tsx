"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import {
  ArrowRightIcon,
  AtIcon,
  BoltIcon,
  CheckIcon,
  ChevronDown,
  CloseIcon,
  DownloadIcon,
  GlobeIcon,
  LinkIcon,
  MoreIcon,
  ImageIcon,
  PanelIcon,
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
  type MarketRead,
  type Product,
} from "@/lib/ad-run";
import {
  brandColorToRgb,
  expandBrandColorHex,
  parseColorInput,
  type BrandColor,
} from "@/lib/brand-color";
import {
  activeMention,
  insertMention,
  matchProducts,
  mentionedIn,
  nameProductAt,
  type ActiveMention,
} from "@/lib/mentions";
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
import {
  IMAGE_MODELS,
  imageModelById,
  photographCapacity,
  takesProductPhoto,
  type ImageModel,
  type ImageModelId,
} from "@/lib/generate/models";
import {
  nearestRatio,
  supportedRatios,
  type AspectRatio,
} from "@/lib/generate/shape";
import type { AdMakerController, AdSlot } from "@/hooks/use-ad-maker";

type IdleController = Extract<AdMakerController, { phase: "idle" }>;
type BriefController = Extract<AdMakerController, { phase: "brief" }>;
type CatalogController = Extract<AdMakerController, { phase: "catalog" }>;
type DnaController = Extract<AdMakerController, { phase: "dna" }>;
/**
 * The studio is the only screen after the brand is confirmed. Generating an
 * image adds it to the sheet in place, so there is nowhere else to go and
 * nothing here needs to know which of the run's phases it is standing in.
 */
type StudioController = Extract<
  AdMakerController,
  { phase: "compose" } | { phase: "generating" } | { phase: "done" }
>;

const EXAMPLE_DOMAINS = ["stripe.com", "linear.app", "notion.so", "vercel.com"];

export function AdMaker({ s }: { s: AdMakerController }) {
  // The studio owns its whole viewport, so the shell's breathing room above
  // every other screen would show as a band of page above it and push it down.
  const studio =
    s.phase === "compose" || s.phase === "generating" || s.phase === "done";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background font-sans antialiased">
      <div
        className={`relative z-10 flex flex-1 flex-col ${studio ? "" : "pt-6"}`}
      >
        {s.phase === "idle" ? (
          <Hero s={s} />
        ) : s.phase === "brief" ? (
          <Researching s={s} />
        ) : s.phase === "catalog" ? (
          <Catalog s={s} />
        ) : s.phase === "dna" ? (
          <BrandDna s={s} />
        ) : (
          <Studio s={s} />
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
      <div className="studio-scroll grid max-h-[46vh] grid-cols-4 gap-2 overflow-y-auto pr-1">
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
      <div className="studio-scroll max-h-[46vh] space-y-1 overflow-y-auto pr-1">
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

/** One trait, sized to sit in a row of them without becoming the loudest thing. */
function TraitChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="truncate rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground ring-1 ring-border">
      {children}
    </span>
  );
}

/**
 * One named line of the market read.
 *
 * Every other card on this page is a single field and says what it is in the
 * label along its bottom edge. This one carries four, so each says its own
 * name — otherwise "computer peripherals" above "mechanical keyboards" is two
 * anonymous phrases, and which is the sector is anyone's guess until the sheet
 * is opened. The names match the sheet's, so opening it holds still.
 */
function MarketField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 py-2.5 first:pt-0 ${className}`}>
      <p className="text-[9.5px] font-medium uppercase tracking-[0.11em] text-muted-foreground/60">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** What the extract left blank, said as such rather than left as a gap. */
function NotStated() {
  return <p className="text-[12.5px] text-muted-foreground/50">Not stated</p>;
}

/**
 * The market read, standing up in a column.
 *
 * What the shop sells, then who buys it, read top to bottom in the order the
 * sheet edits them. Only the four fields that say something about the brand:
 * `evidence`, `confidence` and `source` record how the extract arrived at
 * this, which is a question about the extractor rather than about the brand
 * being checked.
 */
function MarketSummary({ market }: { market: MarketRead | null }) {
  if (!market) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Not read — the extract did not say what this shop sells or who buys it.
      </p>
    );
  }

  return (
    // Divided and spread: four fields in one card need a line between them to
    // read as four, and a column this tall has room left over — dealt evenly
    // into the gaps it reads as a list, banked at the bottom it reads as one
    // field that failed to load. A long read has no slack to spread and simply
    // stacks from the top.
    <div className="flex h-full min-h-0 flex-col justify-between divide-y divide-border overflow-hidden">
      <MarketField label="Sector">
        {/* pr-7 on this line alone: the pencil sits in this corner, and
            padding the whole column would narrow every line under it to clear
            something only the first one reaches. */}
        {market.sector ? (
          <p className="pr-7 text-[12.5px] leading-snug text-foreground">
            {market.sector}
          </p>
        ) : (
          <NotStated />
        )}
      </MarketField>

      <MarketField label="Niche">
        {market.niche ? (
          <p className="text-[12.5px] leading-snug text-foreground">
            {market.niche}
          </p>
        ) : (
          <NotStated />
        )}
      </MarketField>

      <MarketField label="Audience" className="min-h-0 overflow-hidden">
        {market.audience ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {market.audience}
          </p>
        ) : (
          <NotStated />
        )}
      </MarketField>

      {market.audienceTraits.length > 0 && (
        <MarketField label="Audience traits">
          {/* All of them, not the first few: the column is tall enough to wrap
              eight tags, and a count is only worth showing where they cannot. */}
          <div className="flex flex-wrap gap-1">
            {market.audienceTraits.map((trait) => (
              <TraitChip key={trait}>{trait}</TraitChip>
            ))}
          </div>
        </MarketField>
      )}
    </div>
  );
}

/** A market read with nothing in it, for a brand the extract said nothing about. */
const EMPTY_MARKET: MarketRead = {
  sector: "",
  niche: "",
  audience: "",
  audienceTraits: [],
  evidence: "",
  confidence: null,
  source: "",
};

/**
 * Correcting what the extract inferred.
 *
 * The same four fields the card shows. `evidence`, `confidence` and `source`
 * ride along on the Brief and are not offered here: they record how the
 * extractor arrived at the read, and a person rewriting the audience does not
 * change which products it was inferred from or how sure the model was.
 */
function MarketEditor({
  market,
  onChange,
  /** Only where this is the whole sheet: in the studio's it sits last, and a
      field that grabs focus there scrolls the brand's name out of view. */
  autoFocus = false,
}: {
  market: MarketRead | null;
  onChange: (next: MarketRead | null) => void;
  autoFocus?: boolean;
}) {
  const value = market ?? EMPTY_MARKET;

  const edit = (patch: Partial<MarketRead>) => {
    const next = { ...value, ...patch };
    // Emptying all three is "no market read", not a read that says nothing —
    // the same test context.ts applies to the extract on the way in.
    const stated = next.sector.trim() || next.niche.trim() || next.audience.trim();
    onChange(stated ? next : null);
  };

  return (
    <>
      <Field label="Sector" hint="The broad category, e.g. computer accessories.">
        <input
          type="text"
          autoFocus={autoFocus}
          value={value.sector}
          maxLength={AD_RUN_LIMITS.sector}
          placeholder="Not stated"
          onChange={(e) => edit({ sector: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Niche" hint="The narrower one within it, e.g. mechanical keyboards.">
        <input
          type="text"
          value={value.niche}
          maxLength={AD_RUN_LIMITS.niche}
          placeholder="Not stated"
          onChange={(e) => edit({ niche: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Audience" hint="Who buys, in a sentence.">
        <textarea
          rows={3}
          value={value.audience}
          maxLength={AD_RUN_LIMITS.audience}
          placeholder="Not stated"
          onChange={(e) => edit({ audience: e.target.value })}
          className="input resize-none"
        />
      </Field>

      <Field
        label="Audience traits"
        hint={`The same read as tags, separated by commas. At most ${AD_RUN_LIMITS.audienceTraits}.`}
      >
        <input
          type="text"
          // Split on the way out and joined on the way in, rather than held as
          // a parsed list: splitting per keystroke eats the comma the moment
          // it is typed, before the next trait has been started.
          value={value.audienceTraits.join(", ")}
          placeholder="adult gamers, programmers"
          onChange={(e) =>
            edit({
              audienceTraits: e.target.value
                .split(",")
                .map((trait) => trait.trim().slice(0, AD_RUN_LIMITS.audienceTrait))
                .filter(Boolean)
                .slice(0, AD_RUN_LIMITS.audienceTraits),
            })
          }
          className="input"
        />
      </Field>
    </>
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
  | "images"
  | "market";

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
  market: {
    title: "Market",
    hint: "What the shop sells and who buys it. Inferred, not stated — so this is the field most worth reading twice.",
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

      {/* 5x4 exactly: every cell is spoken for, so the varied card sizes still
          resolve into one rectangle instead of a ragged last row.

          Market is a column rather than a row. It is the only card carrying a
          sentence and a row of tags at once, and a row gave it the page's full
          width but a fifth of its height — which cut its own tags off, and
          took the height out of every other card to do it. Standing it up on
          the right gives the sentence somewhere to go, and hands the other
          eight cards back the four rows they were drawn for.

          Its column is wider than the other four. An even fifth is enough for
          a swatch or a type name, and this card carries four labelled fields
          and a paragraph — at that width the audience broke every three or
          four words, which is what made a short sentence look like a wall. */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.7fr)] grid-rows-4 gap-2.5">
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

        {/* Placed rather than flowed: an auto-placed row-span-4 would be dealt
            whichever column the eight cards above happen to leave. */}
        <DnaCard
          label="Market"
          className="col-start-5 row-start-1 row-span-4"
          onEdit={() => open("market")}
          editLabel="Edit the market read"
        >
          <MarketSummary market={b.market} />
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

          {editing === "market" && (
            <MarketEditor
              market={draft.market}
              onChange={(market) => patch({ market })}
              autoFocus
            />
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
/** One image a person asked for by name, and how it is getting on. */
type Composition = {
  id: number;
  prompt: string;
  status: "loading" | "done" | "error";
  url?: string;
  message?: string;
};

function Studio({ s }: { s: StudioController }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModelId>(IMAGE_MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");

  /**
   * The models do not offer the same shapes, so choosing one can retire the
   * shape already chosen. Carrying the nearest across keeps a portrait a
   * portrait instead of asking for something the model would answer with a
   * square.
   */
  const chooseModel = (next: ImageModelId) => {
    setModel(next);
    const chosen = imageModelById(next);
    if (chosen) setAspectRatio((was) => nearestRatio(was, chosen));
  };
  const [made, setMade] = useState<readonly Composition[]>([]);
  /**
   * Every Product named so far. The text stays the source of truth — this is
   * only how a name typed in the box is matched back to its photograph.
   */
  const [named, setNamed] = useState<readonly Product[]>([]);
  const [railOpen, setRailOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const edgeReached = useLeftEdgeReach(!railOpen);
  const sideBySide = useSideBySide();
  const busy = made.some((c) => c.status === "loading");
  /** So the panel can name a Product into the box without owning its caret. */
  const composer = useRef<ComposerHandle>(null);

  // Object URLs are owned here, so they are released when the screen goes.
  useEffect(
    () => () => {
      made.forEach((c) => c.url && URL.revokeObjectURL(c.url));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const compose = async () => {
    const asked = prompt.trim();
    if (!asked) return;
    // Only the Products still named in the text: deleting a name un-mentions it.
    const products = mentionedIn(asked, named);
    const id = Date.now();
    setMade((was) => [{ id, prompt: asked, status: "loading" }, ...was]);
    setPrompt("");
    setNamed([]);

    try {
      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: asked,
          model,
          aspectRatio,
          brandName: s.brief.brandName,
          colorA: s.brief.colorA,
          colorB: s.brief.colorB,
          fontFamily: s.brief.fontFamily,
          products,
        }),
      });

      if (!response.ok) {
        const { error } = (await response
          .json()
          .catch(() => ({ error: "That image failed to render." }))) as {
          error?: string;
        };
        setMade((was) =>
          was.map((c) =>
            c.id === id
              ? { ...c, status: "error", message: error ?? "Failed." }
              : c,
          ),
        );
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      setMade((was) =>
        was.map((c) => (c.id === id ? { ...c, status: "done", url } : c)),
      );
    } catch {
      setMade((was) =>
        was.map((c) =>
          c.id === id
            ? { ...c, status: "error", message: "Couldn't reach the server." }
            : c,
        ),
      );
    }
  };

  return (
    <div className="studio-bg flex min-h-[100dvh] w-full flex-col lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
      {/* Slid aside rather than unmounted, so the panel leaves the way it
          arrives. The negative margin is what the sheet closes into: the panel
          keeps its width and travels out of the row, and the root's overflow
          clip takes care of the part that leaves the window. */}
      <div
        aria-hidden={!railOpen}
        // The travel is an inline style rather than a class: it is one number
        // that depends on the breakpoint, and a media-query utility cannot be
        // read back or interpolated as reliably as the number itself.
        style={
          sideBySide
            ? { marginLeft: railOpen ? 0 : -RAIL_WIDTH }
            : { maxHeight: railOpen ? "80vh" : 0 }
        }
        className={`rail-slide shrink-0 overflow-hidden lg:h-[100dvh] lg:w-[292px] ${
          railOpen ? "" : "pointer-events-none"
        }`}
      >
        <div className="h-full w-full lg:w-[292px]">
          <BrandRail
            brief={s.brief}
            submittedDomain={s.submittedDomain}
            products={"products" in s ? s.products : []}
            onClose={() => setRailOpen(false)}
            onEdit={() => setEditing(true)}
            onName={(product) => composer.current?.name(product)}
          />
        </div>
      </div>

      <main className="rail-neighbour relative flex min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden">
        {/* No bar above the sheet — the work starts at the top of the window.
            The one control that has to survive hiding the panel waits at the
            edge the panel came from, and only while it is being reached for. */}
        {!railOpen && (
          <button
            onClick={() => setRailOpen(true)}
            aria-label="Show the brand panel"
            title="Show the brand panel"
            className={`studio-panel fixed left-3 top-4 z-30 grid size-9 place-items-center rounded-lg border border-white/[0.14] text-[#8b8b93] transition-[opacity,transform] duration-300 ease-out hover:text-[#f4f2ef] focus-visible:opacity-100 ${
              edgeReached
                ? "translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-3 opacity-0"
            }`}
          >
            <PanelIcon className="size-4" />
          </button>
        )}

        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto pb-40">
          {made.length === 0 ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-[14px] text-[#c9c7c2]">
                Nothing made yet for {s.brief.brandName}
              </p>
              <p className="max-w-sm text-[12px] leading-relaxed text-[#6f6f78]">
                Type what you want below. The brand&apos;s name, colours and
                typeface are sent with every prompt, so you only describe the
                picture.
              </p>
            </div>
          ) : (
            // The hairlines belong to the tiles, not to the grid behind them.
            // Painting the container and letting 1px gaps show through draws a
            // clean mosaic only while the last row is full: three columns and
            // one image leaves two cells with nothing over them, and the grid's
            // own paint becomes a grey slab sitting beside the picture.
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {made.map((c, position) => (
                <CompositionTile
                  key={c.id}
                  composition={c}
                  newest={position === 0 && c.status === "done"}
                />
              ))}
            </div>
          )}
        </div>

        <Composer
          handle={composer}
          onGenerate={() => void compose()}
          busy={busy}
          busyLabel="Generating…"
          action="Generate"
          note="Enter to generate · type @ to name a product · the brand's name, colours and typeface go with every prompt"
          prompt={prompt}
          setPrompt={setPrompt}
          model={model}
          setModel={chooseModel}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          products={s.products}
          // The text is the source of truth for what is named, so the warning
          // below the box appears and clears as a name is typed or deleted.
          mentioned={mentionedIn(prompt, named)}
          onMention={(product) =>
            setNamed((was) =>
              was.some((p) => p.name === product.name) ? was : [...was, product],
            )
          }
        />
      </main>

      {editing && (
        <BrandSheet
          brief={s.brief}
          onCommit={s.editBrief}
          onClose={() => setEditing(false)}
          onReset={s.reset}
        />
      )}
    </div>
  );
}

/** One frame on the sheet, for an image asked for by name. */
function CompositionTile({
  composition: c,
  newest,
}: {
  composition: Composition;
  newest: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    // Right and bottom only: every edge between two tiles is drawn once, by
    // the one above or to the left of it, so the seams stay a single hairline
    // and an empty cell draws nothing at all.
    <div className="group studio-bg relative aspect-square overflow-hidden border-b border-r border-white/[0.14]">
      {c.status === "done" && c.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.url}
            alt={c.prompt}
            onLoad={() => setLoaded(true)}
            className={`size-full object-cover transition-[opacity,transform,filter] duration-700 ${
              loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.02] opacity-0 blur-md"
            }`}
          />
          {newest && (
            <>
              <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25" />
              <span className="absolute left-2.5 top-2.5 rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.1em] text-white/90 backdrop-blur-sm">
                New
              </span>
            </>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="p-2.5">
              <p className="line-clamp-2 text-[11px] leading-snug text-white/85">
                {c.prompt}
              </p>
              <div className="pointer-events-auto mt-2">
                <a
                  href={c.url}
                  download={`${c.id}.png`}
                  title="Download"
                  aria-label="Download"
                  className="grid size-7 place-items-center rounded-md bg-white/[0.12] text-white/80 backdrop-blur-sm transition hover:bg-white/25 hover:text-white"
                >
                  <DownloadIcon />
                </a>
              </div>
            </div>
          </div>
        </>
      ) : c.status === "error" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-[12.5px] text-[#c9c7c2]">Didn&apos;t render</p>
          <p className="max-w-[220px] text-[11px] leading-relaxed text-[#6f6f78]">
            {c.message}
          </p>
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2.5 p-6 text-center">
          <Shimmer />
          <p className="line-clamp-3 text-[11px] leading-snug text-[#6f6f78]">
            {c.prompt}
          </p>
        </div>
      )}
    </div>
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

/**
 * True while the pointer is near the left edge of the window.
 *
 * With the panel hidden there is nothing on screen to aim at, and a button
 * parked permanently over the sheet is the clutter hiding the panel was meant
 * to escape. Reaching for the edge is the gesture that asks for it back, so
 * the edge is what listens.
 */
/** True once the layout is wide enough for the rail to be a side column. */
/** The rail's width, shared by the panel and the distance it travels. */
const RAIL_WIDTH = 292;

function useSideBySide(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

function useLeftEdgeReach(active: boolean, within = 72): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!active) {
      setNear(false);
      return;
    }
    const onMove = (event: PointerEvent) => setNear(event.clientX <= within);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, within]);

  return near;
}

/** The brand, kept beside the work rather than on top of it. */
/**
 * The menu one product row opens, positioned against the row's own button.
 *
 * Fixed rather than absolute: the list it belongs to scrolls, and a menu
 * positioned inside a scrolling box is clipped by it the moment it is longer
 * than the row that opened it — which is always.
 */
function ProductRowMenu({
  anchor,
  onName,
  onShow,
  onClose,
}: {
  anchor: DOMRect;
  onName: () => void;
  onShow: () => void;
  onClose: () => void;
}) {
  const WIDTH = 168;
  const HEIGHT = 76;
  // Right-aligned to the button, and flipped above it near the bottom of the
  // window, where a menu opening downward would open off the end of it.
  const left = Math.max(8, anchor.right - WIDTH);
  const below = anchor.bottom + 6;
  const top = below + HEIGHT > window.innerHeight ? anchor.top - HEIGHT - 6 : below;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item =
    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-[#c9c7c2] transition hover:bg-white/[0.08] hover:text-[#f4f2ef]";

  return (
    <>
      {/* Catches the press that dismisses, so a click elsewhere closes the menu
          instead of landing on whatever it was over. */}
      <div className="fixed inset-0 z-40" onPointerDown={onClose} />
      <div
        role="menu"
        style={{ top, left, width: WIDTH }}
        className="fixed z-50 animate-sheet-in rounded-[12px] border border-white/[0.14] bg-[#151517] p-1 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]"
      >
        <button type="button" role="menuitem" onClick={onName} className={item}>
          <AtIcon className="size-3.5 shrink-0 text-[#6f6f78]" />
          Mention in prompt
        </button>
        <button type="button" role="menuitem" onClick={onShow} className={item}>
          <ImageIcon className="size-3.5 shrink-0 text-[#6f6f78]" />
          Show product
        </button>
      </div>
    </>
  );
}

/**
 * One Product, at the size the shop photographs it.
 *
 * The panel's row is 28px of thumbnail and a truncated name, which is enough to
 * pick between products already known and not enough to recognise one. This is
 * the same entry with nothing left out.
 */
function ProductSheet({
  product,
  onName,
  onClose,
}: {
  product: Product;
  onName: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-50 grid place-items-center p-5"
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-sheet-in relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/[0.14] bg-[#151517] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-lg bg-black/40 text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
        >
          <CloseIcon />
        </button>

        {/* Light behind the picture, not dark: a shop photographs its articles
            on white, and a cut-out on a dark panel loses its own edges. */}
        <div className="logo-light grid aspect-square w-full place-items-center overflow-hidden">
          {product.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.imageUrl}
              alt={product.name}
              className="size-full object-contain"
            />
          ) : (
            <span className="text-[12px] text-zinc-500">No photograph</span>
          )}
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="min-w-0">
            <h2 className="text-[15px] leading-snug text-[#f4f2ef]">
              {product.name}
            </h2>
            {product.price !== null && (
              <p className="mt-1 text-[13px] text-[#8b8b93]">
                {product.currency} {product.price}
              </p>
            )}
          </div>

          {product.description && (
            <p className="studio-scroll max-h-24 overflow-y-auto pr-1 text-[12px] leading-relaxed text-[#8b8b93]">
              {product.description}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onName}
              className="flex-1 rounded-lg bg-[#6d28d9] px-3 py-2 text-[12.5px] font-medium text-white transition hover:bg-[#7c3aed]"
            >
              Mention in prompt
            </button>
            {product.url && (
              // The shop's own page, opened by the person rather than for them.
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                title={product.url}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.14] text-[#8b8b93] transition hover:border-white/25 hover:text-[#f4f2ef]"
              >
                <LinkIcon className="size-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandRail({
  brief: b,
  submittedDomain,
  products,
  onClose,
  onEdit,
  onName,
}: {
  brief: AdBrief;
  submittedDomain: string;
  products: readonly Product[];
  onClose: () => void;
  onEdit: () => void;
  /** Writes the Product's name into the prompt box, at whatever it is doing. */
  onName: (product: Product) => void;
}) {
  /**
   * Searched because a shop runs to hundreds — nouvona.com publishes 107 and
   * nuphy.com 680 — and scrolling is no way to find one by name. The same
   * search the "@" picker runs, so what is found here is found there.
   */
  const [query, setQuery] = useState("");
  const found = matchProducts(products, query, products.length);

  /** The row whose menu is open, with the button it has to sit against. */
  const [menu, setMenu] = useState<{ product: Product; anchor: DOMRect } | null>(
    null,
  );
  const [showing, setShowing] = useState<Product | null>(null);

  const name = (product: Product) => {
    onName(product);
    setMenu(null);
    setShowing(null);
  };

  return (
    <aside className="studio-panel flex h-full w-full shrink-0 flex-col border-b border-white/[0.14] lg:h-[100dvh] lg:w-[292px] lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2.5 border-b border-white/[0.14] px-3.5 py-3">
        <div className="logo-light grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              b.logoUrl ??
              `https://www.google.com/s2/favicons?sz=64&domain=${submittedDomain}`
            }
            alt=""
            className="logo-edge max-h-5 max-w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#f4f2ef]">
            {b.brandName}
          </p>
          <p className="truncate text-[10.5px] text-[#6f6f78]">{b.domain}</p>
        </div>
        {/* Both controls the panel owns, in the corner it owns. */}
        <button
          onClick={onEdit}
          aria-label="Edit brand"
          title="Edit brand"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-[#6f6f78] transition hover:bg-white/[0.07] hover:text-[#f4f2ef]"
        >
          <PencilIcon className="size-3.5" />
        </button>
        <button
          onClick={onClose}
          aria-label="Hide the brand panel"
          title="Hide the brand panel"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-[#6f6f78] transition hover:bg-white/[0.07] hover:text-[#f4f2ef]"
        >
          <PanelIcon className="size-4" />
        </button>
      </div>

      {/* The portfolio, said in as little room as it can be said in: the
          products below are the longer list, and they are what a person
          scrolls this panel to reach. */}
      <div className="shrink-0 space-y-2.5 border-b border-white/[0.14] px-3.5 py-3">
        {b.colors.length > 0 && (
          <div className="flex gap-0.5 overflow-hidden rounded-[5px]">
            {b.colors.slice(0, AD_RUN_LIMITS.palette).map((color, index) => (
              <span
                key={`${index}-${color.hex}`}
                title={`${color.name ?? "Colour"} · ${color.hex}`}
                className="h-5 min-w-0 flex-1"
                style={{ background: color.hex }}
              />
            ))}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate text-[15px] text-[#f4f2ef]"
            style={{ fontFamily: fontPreviewStack(b.fontFamily) }}
          >
            {b.brandName}
          </span>
          <span className="shrink-0 truncate text-[10.5px] text-[#6f6f78]">
            {b.fontFamily ?? "Not stated"}
          </span>
        </div>

        {b.mood && (
          <p className="line-clamp-2 text-[11.5px] leading-relaxed text-[#8b8b93]">
            {b.mood}
          </p>
        )}

        {/* Who the ads are for, under the look they are made in. The niche
            names the shop and the traits name its buyers; the audience
            sentence is the tooltip, because this rail is a column and that
            sentence is what turns it into a paragraph. */}
        {b.market && (
          <div className="space-y-1.5" title={b.market.audience || undefined}>
            {(b.market.niche || b.market.sector) && (
              <p className="truncate text-[11px] text-[#8b8b93]">
                {b.market.niche || b.market.sector}
                {b.market.niche && b.market.sector && (
                  <span className="text-[#6f6f78]"> · {b.market.sector}</span>
                )}
              </p>
            )}
            {b.market.audienceTraits.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {b.market.audienceTraits.slice(0, 3).map((trait) => (
                  <span
                    key={trait}
                    className="truncate rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-[#8b8b93]"
                  >
                    {trait}
                  </span>
                ))}
                {b.market.audienceTraits.length > 3 && (
                  <span
                    title={b.market.audienceTraits.slice(3).join(", ")}
                    className="text-[10px] text-[#6f6f78]"
                  >
                    +{b.market.audienceTraits.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {b.languages.slice(0, 3).map((tag) => (
            <span
              key={tag}
              title={languageName(tag)}
              className="rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-[#8b8b93]"
            >
              {tag}
            </span>
          ))}
          {b.languages.length > 3 && (
            <span className="text-[10px] text-[#6f6f78]">
              +{b.languages.length - 3}
            </span>
          )}
          <span className="ml-auto truncate text-[10.5px] text-[#6f6f78]">
            {b.colorA} · {b.colorB}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-baseline justify-between px-3.5 pb-1.5 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#6f6f78]">
          Products
        </p>
        <p className="text-[10.5px] text-[#6f6f78]">
          {query ? `${found.length}/${products.length}` : products.length}
        </p>
      </div>

      {/* Above the scroll rather than inside it: a search that leaves with the
          list it is narrowing is no use once the list is long. */}
      {products.length > 0 && (
        <div className="shrink-0 px-3.5 pb-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products…"
            className="w-full rounded-[6px] border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[11.5px] text-[#f4f2ef] outline-none transition placeholder:text-[#6f6f78] focus:border-white/25"
          />
        </div>
      )}

      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {products.length === 0 ? (
          <p className="px-1.5 text-[11.5px] text-[#6f6f78]">None found</p>
        ) : found.length === 0 ? (
          <p className="px-1.5 text-[11.5px] text-[#6f6f78]">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {found.map((product) => (
              <li key={product.name}>
                <div
                  title={product.description || product.name}
                  className={`group flex items-center gap-2 rounded-lg px-1.5 py-1 transition ${
                    menu?.product.name === product.name
                      ? "bg-white/[0.05]"
                      : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="logo-light size-7 shrink-0 overflow-hidden rounded-[5px]">
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
                    <span className="block truncate text-[11.5px] text-[#c9c7c2]">
                      {product.name}
                    </span>
                    {product.price !== null && (
                      <span className="block text-[10px] text-[#8b8b93]">
                        {product.currency} {product.price}
                      </span>
                    )}
                  </span>

                  {/* Shown on hover, and whenever it is focused or open: an
                      affordance only a mouse can find is one a keyboard cannot
                      reach at all. */}
                  <button
                    type="button"
                    aria-label={`Actions for ${product.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.product.name === product.name}
                    onClick={(event) => {
                      // Measured here rather than inside the updater below:
                      // React runs that after the handler has returned, by
                      // which time the event has let go of the button.
                      const anchor =
                        event.currentTarget.getBoundingClientRect();
                      setMenu((was) =>
                        was?.product.name === product.name
                          ? null
                          : { product, anchor },
                      );
                    }}
                    className={`grid size-6 shrink-0 place-items-center rounded-md text-[#6f6f78] transition hover:bg-white/[0.09] hover:text-[#f4f2ef] focus:outline-none focus-visible:opacity-100 group-hover:opacity-100 ${
                      menu?.product.name === product.name
                        ? "bg-white/[0.09] text-[#f4f2ef] opacity-100"
                        : "opacity-0"
                    }`}
                  >
                    <MoreIcon className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menu && (
        <ProductRowMenu
          anchor={menu.anchor}
          onName={() => name(menu.product)}
          onShow={() => {
            setShowing(menu.product);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {showing && (
        <ProductSheet
          product={showing}
          onName={() => name(showing)}
          onClose={() => setShowing(null)}
        />
      )}
    </aside>
  );
}

/**
 * Everything about the brand, corrected in one place.
 *
 * The studio shows the brand rather than asking about it, so the corrections
 * live behind one button instead of a pencil on every line — there is no
 * catalogue of cards here to hang them on.
 */
function BrandSheet({
  brief,
  onCommit,
  onClose,
  onReset,
}: {
  brief: AdBrief;
  onCommit: (patch: Partial<AdBrief>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<AdBrief>(brief);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const patch = (next: Partial<AdBrief>) =>
    setDraft((was) => ({ ...was, ...next }));

  return (
    <EditSheet
      title="Brand"
      hint="Everything the extract read. Correct anything it got wrong."
      onClose={onClose}
      onSave={() => {
        onCommit(draft);
        onClose();
      }}
    >
      <div className="studio-scroll max-h-[58vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Brand name">
          <input
            type="text"
            value={draft.brandName}
            maxLength={AD_RUN_LIMITS.brandName}
            onChange={(e) => patch({ brandName: e.target.value })}
            className="input"
          />
        </Field>

        <Field label="Logo">
          <div className="logo-light mb-2 grid h-24 place-items-center overflow-hidden rounded-xl p-3">
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
          </div>
          <input
            type="text"
            value={draft.logoUrl ?? ""}
            maxLength={AD_RUN_LIMITS.logoUrl}
            placeholder="https://example.com/logo.png"
            onChange={(e) => patch({ logoUrl: e.target.value.trim() || null })}
            className="input"
          />
          <div className="mt-2">
            <LogoUpload
              onUploaded={(url) => patch({ logoUrl: url })}
              disabled={uploading}
              setUploading={setUploading}
              error={uploadError}
              setError={setUploadError}
            />
          </div>
        </Field>

        <FontPicker
          family={draft.fontFamily}
          brandName={draft.brandName}
          onChange={(fontFamily) => patch({ fontFamily })}
        />

        <PaletteEditor
          colors={draft.colors}
          colorA={draft.colorA}
          colorB={draft.colorB}
          onChange={patch}
        />

        <LanguagePicker
          languages={draft.languages}
          onChange={(languages) => patch({ languages })}
        />

        <Field label="Headline">
          <textarea
            rows={2}
            value={draft.headline}
            maxLength={AD_RUN_LIMITS.brandHeadline}
            placeholder={draft.description || "Not stated"}
            onChange={(e) => patch({ headline: e.target.value })}
            className="input resize-none"
          />
        </Field>

        <MarketEditor
          market={draft.market}
          onChange={(market) => patch({ market })}
        />

        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <RefreshIcon /> Start over with a different brand
        </button>
      </div>
    </EditSheet>
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

/**
 * How far the prompt box may grow before it scrolls instead. Past this it
 * starts eating the sheet it is sat over, which is the thing being described.
 */
const COMPOSER_MAX_LINES = 6;

/** Should the box's own line height ever fail to resolve to a number. */
const COMPOSER_FALLBACK_HEIGHT = 130;

/**
 * Puts the caret where a name was just written, once React has written it.
 *
 * Deferred because the box still holds the old text when the handler returns —
 * a selection set now would be measured against a sentence one name shorter.
 * A timer rather than an animation frame: frames stop being handed out while
 * the tab is in the background, and a caret is not a thing being painted, so a
 * Product named just before switching away should still be waiting correctly
 * when the person comes back.
 */
function placeCaret(box: React.RefObject<HTMLTextAreaElement | null>, caret: number) {
  setTimeout(() => {
    box.current?.focus();
    box.current?.setSelectionRange(caret, caret);
  }, 0);
}

/**
 * Sets the prompt box to the height of its own text, up to the cap.
 *
 * The cap is measured off the box rather than written down as a pixel count,
 * so it lands on a whole line: a hard number left a sliver of the next line
 * showing under the fold, which reads as a clipped box rather than a full one.
 */
function fitComposer(element: HTMLTextAreaElement) {
  const style = getComputedStyle(element);
  const line = parseFloat(style.lineHeight);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const cap = Number.isFinite(line)
    ? line * COMPOSER_MAX_LINES + padding
    : COMPOSER_FALLBACK_HEIGHT;

  // Measured from nothing each time: scrollHeight never reports less than the
  // height already set, so a prompt that shrank could not get the room back.
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, cap)}px`;
}

/**
 * The composer, sat over the sheet rather than above it.
 *
 * Only what is wired is shown as working: Generate re-runs the ads, and the
 * rest of the row states what this run is already set to. A prompt box that
 * quietly discarded what was typed into it would be worse than no prompt box,
 * so it says plainly that the words are not read yet.
 */
/**
 * What this model will not be able to show, said before it is asked to.
 *
 * A named Product with no photograph attached is a Product the model invents,
 * and the picture comes back with the right name on the wrong article. Nothing
 * is blocked — a description is still worth having — but the person deserves to
 * know which it is before spending a generation on it.
 */
function unpicturedWarning(
  model: ImageModel,
  mentioned: readonly Product[],
): string | null {
  const withPhotos = mentioned.filter(({ imageUrl }) => imageUrl).length;
  const capacity = photographCapacity(model);
  const missed = withPhotos - capacity;
  if (missed <= 0) return null;

  const them = missed === 1 ? "it" : "them";
  return capacity === 0
    ? `${model.displayName} cannot be shown a photograph — ${
        missed === 1 ? "the named product" : `all ${missed} named products`
      } will be described rather than pictured, so expect ${them} to be invented.`
    : `${model.displayName} can be shown one photograph — the other ${missed} will be described rather than pictured, so expect ${them} to be invented.`;
}

/**
 * What the panel beside the composer can ask it to do.
 *
 * Naming a Product needs the caret, and the caret belongs to the box. Rather
 * than lift the selection into the studio and keep it in step with every
 * keystroke, the box keeps it and answers a request to write at it.
 */
export type ComposerHandle = {
  name(product: Product): void;
};

function Composer({
  handle,
  onGenerate,
  busy,
  busyLabel,
  action,
  note,
  prompt,
  setPrompt,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  products,
  mentioned,
  onMention,
}: {
  handle?: React.RefObject<ComposerHandle | null>;
  onGenerate: () => void;
  busy: boolean;
  busyLabel: string;
  action: string;
  note: string;
  prompt: string;
  setPrompt: (next: string) => void;
  model: ImageModelId;
  setModel: (next: ImageModelId) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (next: AspectRatio) => void;
  /** The catalogue an "@" searches. */
  products: readonly Product[];
  /** The Products named in the text right now, which the chosen model may not be able to picture. */
  mentioned: readonly Product[];
  /** Records what was named, so its photograph can travel with the request. */
  onMention: (product: Product) => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const matches = mention ? matchProducts(products, mention.query) : [];
  const open = mention !== null && matches.length > 0;

  // The change handler fits the box as it is typed into, but the prompt is
  // also rewritten from outside it — cleared by a generate, extended by a
  // product name — and those have to give the box its height back too.
  useEffect(() => {
    if (box.current) fitComposer(box.current);
  }, [prompt]);

  /** Writes a Product's name into the box, and puts the caret after it. */
  const write = (product: Product, caret: number) => {
    const next = nameProductAt(prompt, caret, product);
    setPrompt(next.value);
    onMention(product);
    setMention(null);
    placeCaret(box, next.caret);
  };

  useImperativeHandle(
    handle,
    () => ({
      name(product) {
        // Read off the box rather than tracked here, because a textarea keeps
        // its selection across blur — which is the whole reason this works.
        // Reaching the panel's menu takes focus off the box, so by now it is
        // certainly not focused, and the caret the person left in it is still
        // sitting exactly where they left it.
        //
        // Clamped because the prompt can be emptied from outside the box, by a
        // generate, without the selection following it down.
        const caret = Math.min(
          box.current?.selectionStart ?? prompt.length,
          prompt.length,
        );
        write(product, caret);
      },
    }),
    // Rebuilt when the text changes: the handle writes into the prompt it was
    // built with, and a stale one would name a Product into an older sentence.
    [prompt, write],
  );

  // Only what this model can actually render: the rest come back as its own
  // default shape without saying they have.
  const chosen = imageModelById(model);
  const ratios = chosen ? supportedRatios(chosen) : (["1:1"] as const);
  const unpictured = chosen ? unpicturedWarning(chosen, mentioned) : null;

  /** Recomputed from the caret on every change, so it closes as soon as it should. */
  const syncMention = (element: HTMLTextAreaElement) => {
    setMention(activeMention(element.value, element.selectionStart ?? 0));
    setHighlighted(0);
  };

  const choose = (product: Product) => {
    if (!mention) return;
    const next = insertMention(prompt, mention, product);
    setPrompt(next.value);
    onMention(product);
    setMention(null);
    // The caret belongs after the name, not at the end of whatever follows it.
    placeCaret(box, next.caret);
  };


  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((was) => {
          const step = event.key === "ArrowDown" ? 1 : -1;
          return (was + step + matches.length) % matches.length;
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(matches[highlighted]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy && prompt.trim()) onGenerate();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
      <div className="pointer-events-auto relative mx-auto w-full max-w-3xl">
        {/* Above the box: the list has to sit clear of the sheet edge, and the
            prompt is already at the bottom of the screen. */}
        {open && (
          <div className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-[14px] border border-white/[0.14] bg-[#151517] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]">
            <p className="border-b border-white/[0.1] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[#6f6f78]">
              {mention?.query ? `Products matching “${mention.query}”` : "Your products"}
            </p>
            {/* Inset rows, for the same reason the Model and Ratio menus have
                them: a full-width highlight cannot follow the panel's corner. */}
            <ul className="studio-scroll max-h-64 overflow-y-auto p-1">
              {matches.map((product, index) => (
                <li key={product.name}>
                  <button
                    type="button"
                    // Mouse down, not click: the textarea must not lose the
                    // caret before the name is inserted at it.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(product);
                    }}
                    onMouseEnter={() => setHighlighted(index)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                      index === highlighted ? "bg-white/[0.08]" : ""
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-white/[0.06]">
                      {product.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.imageUrl}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[8px] text-[#6f6f78]">—</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-[#f4f2ef]">
                        {product.name}
                      </span>
                      {product.price !== null && (
                        <span className="block text-[10.5px] text-[#8b8b93]">
                          {product.currency} {product.price}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="studio-panel rounded-[16px] border border-white/[0.14] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]">
          <div className="flex items-start gap-2 px-3 pt-3">
            <button
              type="button"
              title="Attach a reference image — not wired to the run yet"
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[#6f6f78] transition hover:bg-white/[0.06] hover:text-[#c9c7c2]"
            >
              <ImageIcon />
            </button>
            <textarea
              ref={box}
              rows={1}
              value={prompt}
              onChange={(e) => {
                // Fitted here as well as in the effect: the element already
                // holds the new text, so it resizes in the same frame the
                // character lands rather than a paint later.
                fitComposer(e.currentTarget);
                setPrompt(e.target.value);
                syncMention(e.currentTarget);
              }}
              onKeyUp={(e) => syncMention(e.currentTarget)}
              onClick={(e) => syncMention(e.currentTarget)}
              onBlur={() => setMention(null)}
              onKeyDown={onKeyDown}
              placeholder="Describe the image you want to create…  type @ to name a product"
              className="studio-scroll min-h-[28px] flex-1 resize-none overflow-y-auto bg-transparent py-1 pr-1.5 text-[13.5px] text-[#f4f2ef] outline-none placeholder:text-[#6f6f78]"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1.5">
            <ComposerSelect
              label="Model"
              value={model}
              onChange={(v) => setModel(v as ImageModelId)}
              options={IMAGE_MODELS.map((m) => ({
                value: m.id,
                label: m.displayName,
              }))}
            />
            <ComposerSelect
              label="Ratio"
              value={aspectRatio}
              onChange={(v) => setAspectRatio(v as AspectRatio)}
              options={ratios.map((r) => ({ value: r, label: r }))}
            />
            <div className="flex-1" />
            <button
              onClick={onGenerate}
              disabled={busy}
              className="rounded-lg bg-[#6d28d9] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? busyLabel : action}
            </button>
          </div>
        </div>
        {unpictured ? (
          <p className="mt-1.5 text-center text-[10.5px] text-[#d1a15a]">
            {unpictured}
          </p>
        ) : (
          <p className="mt-1.5 text-center text-[10.5px] text-[#5c5c65]">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The composer's own select.
 *
 * Not a native one. `<select>` hands its list to the platform's widget, which
 * arrives as a white sheet in the system font at the system size, over the
 * darkest panel on the page — and styling it is not on offer: `option`
 * backgrounds are honoured by some browsers, ignored by others, and the menu
 * itself is drawn outside the page entirely. So the one surface the composer
 * opens over itself was the one surface the app had no say in.
 *
 * This is the listbox pattern rather than a div that happens to open: focus
 * stays on the button and the keys land there, so the list needs no tab stop
 * of its own and closing always returns the caret somewhere sensible.
 */
function ComposerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  /** Where the keys are, which is only the same as the choice until they move. */
  const [active, setActive] = useState(selected);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  // Pointer down rather than click: a menu that survives until the mouse comes
  // back up stays open under whatever was just pressed somewhere else.
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  // The list is short enough to fit today and capped in case a model list is
  // not, so the option the keys are on has to be able to bring itself in.
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = (by: number) => {
      event.preventDefault();
      if (!open) return show();
      setActive((was) => (was + by + options.length) % options.length);
    };

    if (event.key === "ArrowDown") return step(1);
    if (event.key === "ArrowUp") return step(-1);
    if (event.key === "Home" && open) {
      event.preventDefault();
      return setActive(0);
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      return setActive(options.length - 1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      return open ? choose(active) : show();
    }
    if (event.key === "Escape" && open) {
      // Stopped here: the composer treats Escape as "close the @ list", and
      // one key press should not dismiss two things at once.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    // Tab is left alone. Moving on closes the menu, which is what leaving means.
    if (event.key === "Tab") setOpen(false);
  };

  return (
    <div ref={root} className="relative hidden sm:block">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label} — ${options[selected]?.label ?? value}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition focus:outline-none focus-visible:border-white/40 ${
          open ? "border-white/25 bg-white/[0.05]" : "border-white/[0.1] hover:border-white/20"
        }`}
      >
        <span className="text-[#6f6f78]">{label}</span>
        <span className="text-[#c9c7c2]">{options[selected]?.label ?? value}</span>
        <ChevronDown
          className={`size-3 text-[#6f6f78] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        // Upward: the composer sits on the bottom edge of the window, so a
        // list that opened downward would open off the end of it.
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          // p-1 with rounded rows inside, rather than a padded list of
          // full-width ones: a highlight that runs to the panel's edge cannot
          // follow its corner, so hovering the first or last option drew a
          // straight line across a rounded end. Inset by the padding it never
          // reaches the corner to fight with it. The row's radius is the
          // panel's less that padding, so the two curves stay concentric.
          className="studio-scroll absolute bottom-full left-0 z-30 mb-1.5 max-h-64 min-w-full origin-bottom animate-sheet-in overflow-y-auto rounded-[12px] border border-white/[0.14] bg-[#151517] p-1 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]"
        >
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={index === selected}
                data-active={index === active}
                // Mouse down, not click: the button below must not take focus
                // off the trigger before the choice is made against it.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                  index === active ? "bg-white/[0.08]" : ""
                } ${index === selected ? "text-[#f4f2ef]" : "text-[#c9c7c2]"}`}
              >
                {/* A reserved slot rather than a conditional icon, so the
                    labels do not shift sideways as the choice moves. */}
                <span className="grid w-3.5 shrink-0 place-items-center">
                  {index === selected && <CheckIcon className="size-3" />}
                </span>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


