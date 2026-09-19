import React, { useEffect, useState, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { apiDownload, apiFetch, apiFetchPage, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

type Segment = 'casino' | 'sports';
type LeaderboardKind = 'multiplier' | 'time' | 'payout' | 'wager';
type LivePeriod = 'daily' | 'weekly' | 'monthly';

interface Promotion {
  id: number;
  segment: Segment;
  slug: string;
  title: string;
  summary: string | null;
  description?: string;
  termsHtml?: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  featured: boolean;
  promoStatus: 'live' | 'ended';
  endsAt: string | null;
  published: boolean;
  viewAllHref?: string | null;
  qualifyingGames?: GameRowPayload[];
  sportEvents?: SportEventPayload[];
  leaderboard?: Record<string, unknown> | null;
  tournamentPanel?: TournamentPanelPayload | null;
  tags?: string[];
  showInSidebar?: boolean;
  sidebarLabel?: string | null;
  sidebarIcon?: string | null;
  sidebarCounter?: string | null;
  sidebarSort?: number;
}

const SIDEBAR_ICON_OPTIONS = [
  { value: 'promotions', label: 'Promotions (default)' },
  { value: 'trophy', label: 'Trophy / race' },
  { value: 'promos/multi', label: 'Multi promo' },
  { value: 'promos/diamond', label: 'Diamond / level up' },
  { value: 'promos/highest-multiplier', label: 'Highest multiplier' },
  { value: 'promos/vip', label: 'VIP' },
  { value: 'promos/vip-bonus', label: 'VIP bonus / chips' },
  { value: 'sports/race-wager', label: 'Sports wager race' },
  { value: 'dice', label: 'Casino dice' },
  { value: 'sports', label: 'Sports' },
];

interface GameRowPayload {
  href: string;
  name: string;
  img: string;
  color?: string;
  indicator?: string;
}

interface SportEventPayload {
  label: string;
  href: string;
  icon?: string;
  sportAlt?: string;
}

interface TournamentPanelPayload {
  ends?: string;
  endsAt?: string;
  prizePool?: string;
  prizeSplit?: string;
}

interface GameRow extends GameRowPayload {
  _key: string;
}

interface SportEventRow extends SportEventPayload {
  _key: string;
}

interface LeaderboardUiRow {
  _key: string;
  rank: string;
  userName: string;
  userVip: string;
  score: string;
  prize: string;
}

const VIP_LEVELS = ['', 'wood', 'bronze', 'silver', 'gold', 'jade', 'ruby', 'diamond', 'opal'];

const LEADERBOARD_PRESETS: Record<
  LeaderboardKind,
  { columns: string[]; widths: string[] }
> = {
  multiplier: {
    columns: ['Rank', 'User', 'Highest Multiplier', 'Prize'],
    widths: ['15%', '30%', '35%', '20%'],
  },
  time: {
    columns: ['User', 'Completed Time', 'Prize'],
    widths: ['30%', '35%', '20%'],
  },
  payout: {
    columns: ['Rank', 'User', 'Payout', 'Prize'],
    widths: ['15%', '30%', '35%', '20%'],
  },
  wager: {
    columns: ['Rank', 'User', 'Wagered', 'Prize'],
    widths: ['15%', '30%', '35%', '20%'],
  },
};

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyGameRow = (): GameRow => ({ _key: newKey(), href: '', name: '', img: '', color: '', indicator: '' });
const emptyEventRow = (): SportEventRow => ({ _key: newKey(), label: '', href: '', icon: '', sportAlt: '' });
const emptyLbRow = (): LeaderboardUiRow => ({
  _key: newKey(),
  rank: '',
  userName: '',
  userVip: '',
  score: '',
  prize: '',
});

type PromoForm = {
  segment: Segment;
  title: string;
  summary: string;
  description: string;
  termsHtml: string;
  imageAlt: string;
  featured: boolean;
  promoStatus: 'live' | 'ended';
  endsAt: string;
  isPublished: boolean;
  image: File | null;
  showQualifyingGames: boolean;
  viewAllHref: string;
  qualifyingGames: GameRow[];
  sportEvents: SportEventRow[];
  showTournamentPanel: boolean;
  panelEndsLabel: string;
  panelEndsAt: string;
  panelPrizePool: string;
  panelPrizeSplit: string;
  showLeaderboard: boolean;
  leaderboardMode: 'static' | 'live';
  leaderboardKind: LeaderboardKind;
  leaderboardPages: string;
  leaderboardLivePeriod: LivePeriod;
  leaderboardLiveLimit: string;
  leaderboardRows: LeaderboardUiRow[];
  tagsText: string;
  showInSidebar: boolean;
  sidebarLabel: string;
  sidebarIcon: string;
  sidebarCounter: string;
  sidebarSort: string;
};

const EMPTY_FORM: PromoForm = {
  segment: 'casino',
  title: '',
  summary: '',
  description: '',
  termsHtml: '',
  imageAlt: '',
  featured: false,
  promoStatus: 'live',
  endsAt: '',
  isPublished: true,
  image: null,
  showQualifyingGames: false,
  viewAllHref: '',
  qualifyingGames: [],
  sportEvents: [],
  showTournamentPanel: false,
  panelEndsLabel: '',
  panelEndsAt: '',
  panelPrizePool: '',
  panelPrizeSplit: '',
  showLeaderboard: false,
  leaderboardMode: 'static',
  leaderboardKind: 'multiplier',
  leaderboardPages: '1',
  leaderboardLivePeriod: 'weekly',
  leaderboardLiveLimit: '50',
  leaderboardRows: [],
  tagsText: '',
  showInSidebar: false,
  sidebarLabel: '',
  sidebarIcon: 'promotions',
  sidebarCounter: '',
  sidebarSort: '0',
};

const inputClass =
  'w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]';
const labelClass = 'block text-sm text-[#8384A5] mb-1';
const sectionClass = 'border border-[#1E2D55] rounded-lg p-4 space-y-3 bg-[#0A1228]';

function parseTags(text: string): string[] {
  return text
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toDatetimeLocal(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildQualifyingGames(form: PromoForm): GameRowPayload[] {
  if (!form.showQualifyingGames) return [];
  return form.qualifyingGames
    .filter((g) => g.href.trim() && g.name.trim() && g.img.trim())
    .map(({ href, name, img, color, indicator }) => ({
      href: href.trim(),
      name: name.trim(),
      img: img.trim(),
      ...(color.trim() ? { color: color.trim() } : {}),
      ...(indicator.trim() ? { indicator: indicator.trim() } : {}),
    }));
}

function buildSportEvents(form: PromoForm): SportEventPayload[] {
  return form.sportEvents
    .filter((e) => e.label.trim() && e.href.trim())
    .map(({ label, href, icon, sportAlt }) => ({
      label: label.trim(),
      href: href.trim(),
      ...(icon.trim() ? { icon: icon.trim() } : {}),
      ...(sportAlt.trim() ? { sportAlt: sportAlt.trim() } : {}),
    }));
}

function buildTournamentPanel(form: PromoForm): TournamentPanelPayload | null {
  if (!form.showTournamentPanel) return null;
  const hasAny =
    form.panelEndsLabel.trim() ||
    form.panelEndsAt ||
    form.panelPrizePool.trim() ||
    form.panelPrizeSplit.trim();
  if (!hasAny) return null;
  return {
    ...(form.panelEndsLabel.trim() ? { ends: form.panelEndsLabel.trim() } : {}),
    ...(form.panelEndsAt ? { endsAt: new Date(form.panelEndsAt).toISOString() } : {}),
    ...(form.panelPrizePool.trim() ? { prizePool: form.panelPrizePool.trim() } : {}),
    ...(form.panelPrizeSplit.trim() ? { prizeSplit: form.panelPrizeSplit.trim() } : {}),
  };
}

function buildLeaderboard(form: PromoForm): Record<string, unknown> | null {
  if (!form.showLeaderboard) return null;
  const preset = LEADERBOARD_PRESETS[form.leaderboardKind];
  const pages = Math.max(1, parseInt(form.leaderboardPages, 10) || 1);

  if (form.leaderboardMode === 'live') {
    const limit = Math.min(100, Math.max(1, parseInt(form.leaderboardLiveLimit, 10) || 20));
    return {
      kind: form.leaderboardKind === 'multiplier' || form.leaderboardKind === 'time' ? 'wager' : form.leaderboardKind,
      columns: preset.columns,
      widths: preset.widths,
      pages: 1,
      rows: [],
      live: { source: 'wager_leaderboard', period: form.leaderboardLivePeriod, limit },
    };
  }

  const ranked = preset.columns[0] === 'Rank';
  const rows = form.leaderboardRows
    .filter((r) => r.score.trim() || r.userName.trim() || r.prize.trim())
    .map((r, i) => {
      const rank = r.rank.trim() ? parseInt(r.rank, 10) : ranked ? i + 1 : undefined;
      const user = r.userName.trim()
        ? { name: r.userName.trim(), ...(r.userVip ? { vip: r.userVip } : {}) }
        : null;
      return {
        ...(rank ? { rank } : {}),
        user,
        score: r.score.trim() || '—',
        ...(r.prize.trim() ? { prize: r.prize.trim() } : {}),
      };
    });

  if (!rows.length) return null;

  return {
    kind: form.leaderboardKind,
    columns: preset.columns,
    widths: preset.widths,
    pages,
    rows,
  };
}

function promotionToForm(full: Promotion): PromoForm {
  const games = (full.qualifyingGames ?? []).map((g) => ({
    _key: newKey(),
    href: g.href || '',
    name: g.name || '',
    img: g.img || '',
    color: g.color || '',
    indicator: g.indicator || '',
  }));
  const events = (full.sportEvents ?? []).map((e) => ({
    _key: newKey(),
    label: e.label || '',
    href: e.href || '',
    icon: e.icon || '',
    sportAlt: e.sportAlt || '',
  }));
  const panel = full.tournamentPanel;
  const lb = full.leaderboard as Record<string, any> | null | undefined;
  const live = lb?.live?.source === 'wager_leaderboard';

  let leaderboardRows: LeaderboardUiRow[] = [];
  if (lb?.rows && Array.isArray(lb.rows)) {
    leaderboardRows = lb.rows.map((r: any) => ({
      _key: newKey(),
      rank: r.rank != null ? String(r.rank) : '',
      userName: r.user?.name || '',
      userVip: r.user?.vip || '',
      score: r.score != null ? String(r.score) : '',
      prize: r.prize != null ? String(r.prize) : '',
    }));
  }

  return {
    segment: full.segment,
    title: full.title,
    summary: full.summary || '',
    description: full.description || '',
    termsHtml: full.termsHtml || '',
    imageAlt: full.imageAlt || '',
    featured: full.featured === true,
    promoStatus: full.promoStatus === 'ended' ? 'ended' : 'live',
    endsAt: full.endsAt ? String(full.endsAt).slice(0, 10) : '',
    isPublished: full.published !== false,
    image: null,
    showQualifyingGames: games.length > 0 || Boolean(full.viewAllHref),
    viewAllHref: full.viewAllHref || '',
    qualifyingGames: games.length ? games : [emptyGameRow()],
    sportEvents: events.length ? events : [],
    showTournamentPanel: Boolean(panel),
    panelEndsLabel: panel?.ends || '',
    panelEndsAt: toDatetimeLocal(panel?.endsAt),
    panelPrizePool: panel?.prizePool || '',
    panelPrizeSplit: panel?.prizeSplit || '',
    showLeaderboard: Boolean(lb),
    leaderboardMode: live ? 'live' : 'static',
    leaderboardKind: (lb?.kind as LeaderboardKind) || 'multiplier',
    leaderboardPages: lb?.pages != null ? String(lb.pages) : '1',
    leaderboardLivePeriod: (lb?.live?.period as LivePeriod) || 'weekly',
    leaderboardLiveLimit: lb?.live?.limit != null ? String(lb.live.limit) : '50',
    leaderboardRows: leaderboardRows.length ? leaderboardRows : [emptyLbRow()],
    tagsText: (full.tags ?? []).join(', '),
    showInSidebar: full.showInSidebar === true,
    sidebarLabel: full.sidebarLabel || '',
    sidebarIcon: full.sidebarIcon || 'promotions',
    sidebarCounter: full.sidebarCounter || '',
    sidebarSort: full.sidebarSort != null ? String(full.sidebarSort) : '0',
  };
}

function PromoCover({ imageUrl, alt, className }: { imageUrl: string | null; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSrc(null);
      return undefined;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    apiDownload(imageUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}

const playerPath = (p: Promotion) =>
  p.segment === 'sports' ? `/sports/promotions/${p.slug}` : `/promotions/${p.slug}`;

function RowActions({ onRemove, canRemove }: { onRemove: () => void; canRemove: boolean }) {
  if (!canRemove) return null;
  return (
    <button type="button" onClick={onRemove} className="text-xs text-[#E01B4F] hover:underline shrink-0">
      Remove
    </button>
  );
}

export default function PromotionsAdmin() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverBlobRef = useRef<string | null>(null);

  const clearCoverPreview = () => {
    if (coverBlobRef.current) {
      URL.revokeObjectURL(coverBlobRef.current);
      coverBlobRef.current = null;
    }
    setImagePreview(null);
  };

  const loadCoverPreview = async (imageUrl: string | null | undefined) => {
    clearCoverPreview();
    if (!imageUrl) return;
    try {
      const blob = await apiDownload(imageUrl);
      const url = URL.createObjectURL(blob);
      coverBlobRef.current = url;
      setImagePreview(url);
    } catch {
      setImagePreview(null);
    }
  };

  const fetchRows = async () => {
    try {
      setLoading(true);
      const { data } = await apiFetchPage<Promotion>(ENDPOINTS.promotions.list, {
        query: { page: 1, limit: 100 },
      });
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    clearCoverPreview();
    setShowForm(true);
  };

  const openEdit = async (row: Promotion) => {
    try {
      const full = await apiFetch<Promotion>(buildPath(ENDPOINTS.promotions.get, { id: row.id }));
      setEditing(full);
      setForm(promotionToForm(full));
      setShowForm(true);
      await loadCoverPreview(full.imageUrl);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load promotion');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    clearCoverPreview();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, image: file }));
    if (file) {
      clearCoverPreview();
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else if (editing?.imageUrl) {
      loadCoverPreview(editing.imageUrl);
    } else {
      clearCoverPreview();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and body are required');
      return;
    }

    setSubmitting(true);
    try {
      const qualifyingGames = buildQualifyingGames(form);
      const sportEvents = buildSportEvents(form);
      const tags = parseTags(form.tagsText);
      const tournamentPanel = buildTournamentPanel(form);
      const leaderboard = buildLeaderboard(form);

      const fd = new FormData();
      fd.append('segment', form.segment);
      fd.append('title', form.title);
      fd.append('summary', form.summary);
      fd.append('description', form.description);
      fd.append('termsHtml', form.termsHtml.trim());
      fd.append('showInSidebar', form.showInSidebar ? 'true' : 'false');
      fd.append('sidebarLabel', form.sidebarLabel);
      fd.append('sidebarIcon', form.sidebarIcon);
      fd.append('sidebarCounter', form.sidebarCounter);
      fd.append('sidebarSort', form.sidebarSort || '0');
      fd.append('imageAlt', form.imageAlt);
      fd.append('viewAllHref', form.showQualifyingGames ? form.viewAllHref : '');
      fd.append('qualifyingGames', JSON.stringify(qualifyingGames));
      fd.append('sportEvents', JSON.stringify(sportEvents));
      fd.append('tags', JSON.stringify(tags));
      fd.append('leaderboard', leaderboard ? JSON.stringify(leaderboard) : 'null');
      fd.append('tournamentPanel', tournamentPanel ? JSON.stringify(tournamentPanel) : 'null');
      fd.append('featured', form.featured ? 'true' : 'false');
      fd.append('promoStatus', form.promoStatus);
      fd.append('isPublished', form.isPublished ? 'true' : 'false');
      if (form.endsAt) fd.append('endsAt', new Date(form.endsAt).toISOString());
      if (form.image) fd.append('image', form.image);

      if (editing) {
        await apiFetch(buildPath(ENDPOINTS.promotions.update, { id: editing.id }), {
          method: 'PATCH',
          body: fd,
        });
        toast.success('Promotion updated');
      } else {
        await apiFetch(ENDPOINTS.promotions.create, { method: 'POST', body: fd });
        toast.success('Promotion created');
      }

      closeForm();
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: Promotion) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      await apiFetch(buildPath(ENDPOINTS.promotions.remove, { id: row.id }), { method: 'DELETE' });
      toast.success('Promotion deleted');
      setRows((prev) => prev.filter((b) => b.id !== row.id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete promotion');
    } finally {
      setDeletingId(null);
    }
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').slice(0, 120);

  return (
    <div className="p-4 md:p-6 min-h-screen text-[#F9F9F9] space-y-6">
      <Toaster richColors position="top-right" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F9F9F9]">Promotions</h1>
          <p className="text-[#878AA2] text-sm mt-1">
            {rows.length} promotion{rows.length !== 1 ? 's' : ''} — casino at{' '}
            <code className="text-[#886CFF]">/promotions</code>, sports at{' '}
            <code className="text-[#886CFF]">/sports/promotions</code>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + New Promotion
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#878AA2]">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#878AA2] gap-2">
          <p>No promotions yet.</p>
          <button onClick={openCreate} className="text-[#886CFF] underline text-sm">
            Create your first promotion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <div key={row.id} className="bg-[#0E1831] border border-[#1E2D55] rounded-xl overflow-hidden flex flex-col">
              {row.imageUrl && (
                <PromoCover imageUrl={row.imageUrl} alt={row.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs bg-[#886CFF]/20 text-[#886CFF] px-2 py-0.5 rounded font-medium capitalize">
                    {row.segment}
                  </span>
                  {row.featured && (
                    <span className="text-xs bg-[#FFC23F]/20 text-[#FFC23F] px-2 py-0.5 rounded font-medium">Featured</span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      row.published ? 'bg-[#0ECC68]/20 text-[#0ECC68]' : 'bg-[#FFC23F]/20 text-[#FFC23F]'
                    }`}
                  >
                    {row.published ? 'Published' : 'Draft'}
                  </span>
                  {row.showInSidebar && (
                    <span className="text-xs bg-[#5865F2]/20 text-[#9BA4FF] px-2 py-0.5 rounded font-medium">Sidebar</span>
                  )}
                </div>
                <h3 className="font-semibold text-[#F9F9F9] text-base leading-tight mb-1 line-clamp-2">{row.title}</h3>
                <p className="text-[#878AA2] text-xs flex-1 line-clamp-3">{row.summary || stripHtml(row.summary || '')}</p>
                <p className="text-[#878AA2] text-xs mt-2 font-mono">{playerPath(row)}</p>
                <div className="flex items-center justify-end mt-4 pt-3 border-t border-[#1E2D55] gap-2">
                  <button
                    onClick={() => openEdit(row)}
                    className="text-xs bg-[#1E2D55] text-[#F9F9F9] px-3 py-1.5 rounded transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    disabled={deletingId === row.id}
                    className="text-xs bg-[#E01B4F]/20 hover:bg-[#E01B4F]/40 text-[#E01B4F] px-3 py-1.5 rounded transition disabled:opacity-50"
                  >
                    {deletingId === row.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#1E2D55] sticky top-0 bg-[#0E1831] z-10">
              <h2 className="text-lg font-semibold text-[#F9F9F9]">{editing ? 'Edit Promotion' : 'New Promotion'}</h2>
              <button type="button" onClick={closeForm} className="text-[#878AA2] hover:text-[#F9F9F9] text-xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Segment</label>
                  <select
                    value={form.segment}
                    onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value as Segment }))}
                    className={inputClass}
                  >
                    <option value="casino">Casino</option>
                    <option value="sports">Sports</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status tag</label>
                  <select
                    value={form.promoStatus}
                    onChange={(e) => setForm((f) => ({ ...f, promoStatus: e.target.value as 'live' | 'ended' }))}
                    className={inputClass}
                  >
                    <option value="live">Live</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Title <span className="text-[#E01B4F]">*</span>
                </label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} required />
              </div>

              <div>
                <label className={labelClass}>Summary (tile text)</label>
                <input type="text" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Listing end date (optional)</label>
                <input type="date" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} className={inputClass} />
              </div>

              <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="rounded border-[#1E2D55]" />
                Featured (large tile on page 1)
              </label>

              <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} className="rounded border-[#1E2D55]" />
                Publish on the player site
              </label>

              <div className={sectionClass}>
                <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={form.showInSidebar}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        showInSidebar: e.target.checked,
                        sidebarLabel: f.sidebarLabel || f.title,
                      }))
                    }
                    className="rounded border-[#1E2D55]"
                  />
                  Show under Promotions in the left sidebar
                </label>
                <p className="text-xs text-[#878AA2]">
                  Only appears when published. Lower sort order shows first. Empty label uses the promotion title; empty counter can use the listing end date.
                </p>
                {form.showInSidebar && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className={labelClass}>Sidebar label (optional)</label>
                      <input
                        type="text"
                        value={form.sidebarLabel}
                        onChange={(e) => setForm((f) => ({ ...f, sidebarLabel: e.target.value }))}
                        placeholder={form.title || 'Same as title'}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Icon</label>
                      <select
                        value={form.sidebarIcon}
                        onChange={(e) => setForm((f) => ({ ...f, sidebarIcon: e.target.value }))}
                        className={inputClass}
                      >
                        {SIDEBAR_ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Counter badge (optional)</label>
                      <input
                        type="text"
                        value={form.sidebarCounter}
                        onChange={(e) => setForm((f) => ({ ...f, sidebarCounter: e.target.value }))}
                        placeholder="e.g. 5d or 16h"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Sort order</label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={form.sidebarSort}
                        onChange={(e) => setForm((f) => ({ ...f, sidebarSort: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  Body <span className="text-[#E01B4F]">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="HTML article body (how to play, prize pool, etc.)"
                  rows={8}
                  className={`${inputClass} resize-y font-mono`}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Terms and conditions (optional)</label>
                <p className="text-xs text-[#878AA2] mb-1">
                  HTML only — use <code className="text-[#886CFF]">&lt;ul&gt;</code>, <code className="text-[#886CFF]">&lt;p&gt;</code>,{' '}
                  <code className="text-[#886CFF]">&lt;b&gt;</code>. Shown in a collapsible accordion on the player site; do not paste the accordion wrapper here.
                </p>
                <textarea
                  value={form.termsHtml}
                  onChange={(e) => setForm((f) => ({ ...f, termsHtml: e.target.value }))}
                  placeholder="<ul><li><p>Promotion starts …</p></li></ul>"
                  rows={6}
                  className={`${inputClass} resize-y font-mono`}
                />
              </div>

              {/* Optional qualifying games */}
              <div className={sectionClass}>
                <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={form.showQualifyingGames}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        showQualifyingGames: e.target.checked,
                        qualifyingGames: f.qualifyingGames.length ? f.qualifyingGames : [emptyGameRow()],
                      }))
                    }
                    className="rounded border-[#1E2D55]"
                  />
                  Qualifying games carousel (optional)
                </label>
                {form.showQualifyingGames && (
                  <>
                    <p className="text-xs text-[#878AA2]">Add games shown in a horizontal carousel. Leave a row blank to skip it.</p>
                    <div>
                      <label className={labelClass}>&quot;View all&quot; link (optional)</label>
                      <input
                        type="text"
                        value={form.viewAllHref}
                        onChange={(e) => setForm((f) => ({ ...f, viewAllHref: e.target.value }))}
                        placeholder="/casino/categories/Mines%20Master"
                        className={inputClass}
                      />
                    </div>
                    {form.qualifyingGames.map((g, idx) => (
                      <div key={g._key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#1E2D55]/60 rounded-lg p-3">
                        <div className="sm:col-span-2 flex justify-between items-center">
                          <span className="text-xs text-[#878AA2]">Game {idx + 1}</span>
                          <RowActions
                            canRemove={form.qualifyingGames.length > 1}
                            onRemove={() =>
                              setForm((f) => ({ ...f, qualifyingGames: f.qualifyingGames.filter((x) => x._key !== g._key) }))
                            }
                          />
                        </div>
                        <input placeholder="Game link (/games/…)" value={g.href} onChange={(e) => setForm((f) => ({ ...f, qualifyingGames: f.qualifyingGames.map((x) => (x._key === g._key ? { ...x, href: e.target.value } : x)) }))} className={inputClass} />
                        <input placeholder="Display name" value={g.name} onChange={(e) => setForm((f) => ({ ...f, qualifyingGames: f.qualifyingGames.map((x) => (x._key === g._key ? { ...x, name: e.target.value } : x)) }))} className={inputClass} />
                        <input placeholder="Tile image URL" value={g.img} onChange={(e) => setForm((f) => ({ ...f, qualifyingGames: f.qualifyingGames.map((x) => (x._key === g._key ? { ...x, img: e.target.value } : x)) }))} className={inputClass} />
                        <input placeholder="Badge e.g. 250x (optional)" value={g.indicator} onChange={(e) => setForm((f) => ({ ...f, qualifyingGames: f.qualifyingGames.map((x) => (x._key === g._key ? { ...x, indicator: e.target.value } : x)) }))} className={inputClass} />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, qualifyingGames: [...f.qualifyingGames, emptyGameRow()] }))}
                      className="text-sm text-[#886CFF] hover:underline"
                    >
                      + Add game
                    </button>
                  </>
                )}
              </div>

              {/* Sport events */}
              <div className={sectionClass}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#F9F9F9]">Qualifying sports (optional)</h3>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, sportEvents: [...f.sportEvents, emptyEventRow()] }))} className="text-xs text-[#886CFF] hover:underline">
                    + Add link
                  </button>
                </div>
                <p className="text-xs text-[#878AA2]">Links to tournaments or competitions (shown above the article on sports promos).</p>
                {form.sportEvents.length === 0 && <p className="text-xs text-[#878AA2] italic">No links — skip if not needed.</p>}
                {form.sportEvents.map((ev, idx) => (
                  <div key={ev._key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#1E2D55]/60 rounded-lg p-3">
                    <div className="sm:col-span-2 flex justify-between">
                      <span className="text-xs text-[#878AA2]">Link {idx + 1}</span>
                      <RowActions canRemove onRemove={() => setForm((f) => ({ ...f, sportEvents: f.sportEvents.filter((x) => x._key !== ev._key) }))} />
                    </div>
                    <input placeholder="Label (e.g. US Open Men Singles)" value={ev.label} onChange={(e) => setForm((f) => ({ ...f, sportEvents: f.sportEvents.map((x) => (x._key === ev._key ? { ...x, label: e.target.value } : x)) }))} className={inputClass} />
                    <input placeholder="Path (/sports/tournament/…)" value={ev.href} onChange={(e) => setForm((f) => ({ ...f, sportEvents: f.sportEvents.map((x) => (x._key === ev._key ? { ...x, href: e.target.value } : x)) }))} className={inputClass} />
                    <input placeholder="Icon URL (optional)" value={ev.icon} onChange={(e) => setForm((f) => ({ ...f, sportEvents: f.sportEvents.map((x) => (x._key === ev._key ? { ...x, icon: e.target.value } : x)) }))} className={inputClass} />
                    <input placeholder="Sport name for icon alt (optional)" value={ev.sportAlt} onChange={(e) => setForm((f) => ({ ...f, sportEvents: f.sportEvents.map((x) => (x._key === ev._key ? { ...x, sportAlt: e.target.value } : x)) }))} className={inputClass} />
                  </div>
                ))}
              </div>

              {/* Tournament panel */}
              <div className={sectionClass}>
                <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={form.showTournamentPanel}
                    onChange={(e) => setForm((f) => ({ ...f, showTournamentPanel: e.target.checked }))}
                    className="rounded border-[#1E2D55]"
                  />
                  Countdown &amp; prize panel (optional)
                </label>
                {form.showTournamentPanel && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Ends label (display text)</label>
                      <input value={form.panelEndsLabel} onChange={(e) => setForm((f) => ({ ...f, panelEndsLabel: e.target.value }))} placeholder="Sep 14, 2026, 9:30 AM" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Countdown ends at</label>
                      <input type="datetime-local" value={form.panelEndsAt} onChange={(e) => setForm((f) => ({ ...f, panelEndsAt: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Prize pool</label>
                      <input value={form.panelPrizePool} onChange={(e) => setForm((f) => ({ ...f, panelPrizePool: e.target.value }))} placeholder="$10,000.00" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Prize split (e.g. top 50)</label>
                      <input value={form.panelPrizeSplit} onChange={(e) => setForm((f) => ({ ...f, panelPrizeSplit: e.target.value }))} placeholder="50" className={inputClass} />
                    </div>
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <div className={sectionClass}>
                <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={form.showLeaderboard}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        showLeaderboard: e.target.checked,
                        leaderboardRows: f.leaderboardRows.length ? f.leaderboardRows : [emptyLbRow()],
                      }))
                    }
                    className="rounded border-[#1E2D55]"
                  />
                  Leaderboard table (optional)
                </label>
                {form.showLeaderboard && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Data source</label>
                        <select
                          value={form.leaderboardMode}
                          onChange={(e) => setForm((f) => ({ ...f, leaderboardMode: e.target.value as 'static' | 'live' }))}
                          className={inputClass}
                        >
                          <option value="static">Manual rows (you enter ranks)</option>
                          <option value="live">Live wager leaderboard</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Table type</label>
                        <select
                          value={form.leaderboardKind}
                          onChange={(e) => setForm((f) => ({ ...f, leaderboardKind: e.target.value as LeaderboardKind }))}
                          className={inputClass}
                        >
                          <option value="multiplier">Highest multiplier</option>
                          <option value="time">Completion time</option>
                          <option value="payout">Payout amount</option>
                          <option value="wager">Wager amount</option>
                        </select>
                      </div>
                    </div>
                    {form.leaderboardMode === 'live' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Period</label>
                          <select
                            value={form.leaderboardLivePeriod}
                            onChange={(e) => setForm((f) => ({ ...f, leaderboardLivePeriod: e.target.value as LivePeriod }))}
                            className={inputClass}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>How many rows</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={form.leaderboardLiveLimit}
                            onChange={(e) => setForm((f) => ({ ...f, leaderboardLiveLimit: e.target.value }))}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className={labelClass}>Pagination pages (display only)</label>
                          <input type="number" min={1} value={form.leaderboardPages} onChange={(e) => setForm((f) => ({ ...f, leaderboardPages: e.target.value }))} className={inputClass} />
                        </div>
                        {form.leaderboardRows.map((r, idx) => (
                          <div key={r._key} className="grid grid-cols-2 sm:grid-cols-5 gap-2 border border-[#1E2D55]/60 rounded-lg p-3">
                            <div className="col-span-2 sm:col-span-5 flex justify-between">
                              <span className="text-xs text-[#878AA2]">Row {idx + 1}</span>
                              <RowActions
                                canRemove={form.leaderboardRows.length > 1}
                                onRemove={() => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.filter((x) => x._key !== r._key) }))}
                              />
                            </div>
                            <input placeholder="Rank" value={r.rank} onChange={(e) => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.map((x) => (x._key === r._key ? { ...x, rank: e.target.value } : x)) }))} className={inputClass} />
                            <input placeholder="Username" value={r.userName} onChange={(e) => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.map((x) => (x._key === r._key ? { ...x, userName: e.target.value } : x)) }))} className={inputClass} />
                            <select value={r.userVip} onChange={(e) => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.map((x) => (x._key === r._key ? { ...x, userVip: e.target.value } : x)) }))} className={inputClass}>
                              {VIP_LEVELS.map((v) => (
                                <option key={v || 'none'} value={v}>
                                  {v ? v : 'VIP (optional)'}
                                </option>
                              ))}
                            </select>
                            <input placeholder="Score / time / multi" value={r.score} onChange={(e) => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.map((x) => (x._key === r._key ? { ...x, score: e.target.value } : x)) }))} className={inputClass} />
                            <input placeholder="Prize" value={r.prize} onChange={(e) => setForm((f) => ({ ...f, leaderboardRows: f.leaderboardRows.map((x) => (x._key === r._key ? { ...x, prize: e.target.value } : x)) }))} className={inputClass} />
                          </div>
                        ))}
                        <button type="button" onClick={() => setForm((f) => ({ ...f, leaderboardRows: [...f.leaderboardRows, emptyLbRow()] }))} className="text-sm text-[#886CFF] hover:underline">
                          + Add row
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className={labelClass}>Tags (optional, comma-separated)</label>
                <input
                  type="text"
                  value={form.tagsText}
                  onChange={(e) => setForm((f) => ({ ...f, tagsText: e.target.value }))}
                  placeholder="casino, sports"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Cover image alt text</label>
                <input type="text" value={form.imageAlt} onChange={(e) => setForm((f) => ({ ...f, imageAlt: e.target.value }))} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Cover image</label>
                {imagePreview ? (
                  <img src={imagePreview} alt="Cover preview" className="w-full h-48 object-cover rounded-lg mb-2" />
                ) : editing?.imageUrl ? (
                  <p className="text-xs text-[#878AA2] mb-2">Loading cover…</p>
                ) : null}
                <input type="file" accept=".png,.jpg,.jpeg,.webp" ref={fileRef} onChange={handleFileChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-[#1E2D55] hover:border-[#886CFF] rounded-lg px-4 py-3 text-sm text-[#878AA2] hover:text-[#F9F9F9] transition text-center"
                >
                  {form.image ? form.image.name : editing?.imageUrl ? 'Replace cover image' : 'Upload image (.png, .jpg, .webp)'}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-[#0E1831] pb-1">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-[#878AA2] border border-[#1E2D55] rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] rounded-lg font-medium disabled:opacity-50">
                  {submitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
