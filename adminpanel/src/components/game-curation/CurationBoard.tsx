import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  InputAdornment,
  Checkbox,
} from "@mui/material";
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Image as ImageIcon,
  Save,
  RefreshCw,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { apiFetch, buildPath } from "../../utils/api";
import { ENDPOINTS } from "../../services/endpoints";
import { Curation, CurationScope, JsGame } from "./types";
import { cardSx, inputSx, tdSx, thSx } from "./styles";

/* ─────────────────────────────────────────────────────────────────
   ONE BOARD, FOUR SCREENS

   Providers (collections), Vendor priority, Type priority and Trending
   Games are the same interaction: an ordered list of games, reordered by
   hand, added to from a catalogue picker, saved whole.

   They used to be three ~1,000-line files that had each copied the same
   table, picker, reorder and save logic and then drifted — one sorted the
   picker results and the others did not, two had a "move to top" control
   and one did not, and the save button was disabled on a different
   condition in each. Adding the trending screen as a fourth copy would
   have made that worse. It is one component and four thin callers now.
   ───────────────────────────────────────────────────────────────── */

interface Props {
  scope: CurationScope;
  /** Vendor name, game type, or collection slug. */
  curationKey: string;
  /** Shown above the table — "Trending Games", "Evolution", "Slot Game". */
  title: string;
  subtitle?: string;
  /**
   * Narrows the picker to the same vendor/type the list belongs to.
   *
   * A vendor's priority list may only contain that vendor's games — offering
   * the whole catalogue in the picker would let an operator build a list the
   * lobby then filters back out, with no explanation of where the games went.
   * Collections are cross-catalogue by nature, so they pass nothing.
   */
  pickerFilter?: { vendor?: string; type?: string };
  /** Called after a successful save, so a parent list can refresh its counts. */
  onSaved?: () => void;
  /**
   * Board the WHOLE catalogue, with the curated list as its head.
   *
   * ── WHY THIS IS NOT JUST "SHOW MORE ROWS" ───────────────────────────────
   *
   * The six named collections are exactly what an operator put in them. `all`
   * is every game, so a list of picks cannot be what it holds — saving twenty
   * games there would empty the lobby down to twenty. What an operator is doing
   * on that screen is deciding what comes FIRST, so the board shows the whole
   * catalogue, the head is what gets saved, and the tail keeps the lobby's
   * default order. `jsCuration.constants.js` carries the same note.
   *
   * The tail is deliberately not reorderable: the server orders it by id, so
   * arrows there would move rows that land back where they started on reload.
   */
  priorityOverCatalogue?: boolean;
}

const PICKER_LIMIT = 50;

/**
 * Mirrors `MAX_LIST_SIZE` in jsCuration.constants.js.
 *
 * The curated list is a CSV in one TEXT column read on lobby requests, so the
 * head is bounded. Duplicated rather than fetched because the board has to
 * disable the control BEFORE the write, not explain a 400 afterwards.
 */
const MAX_PRIORITY = 500;

/** One pull of the catalogue for the board. Under the server's cap. */
const CATALOGUE_LIMIT = 5000;

/** Tail rows rendered at once — 2,000 MUI rows is a visibly janky table. */
const TAIL_WINDOW = 100;

const CurationBoard: React.FC<Props> = ({ scope, curationKey, title, subtitle, pickerFilter, onSaved, priorityOverCatalogue }) => {
  const [games, setGames] = useState<JsGame[]>([]);
  const [savedOrder, setSavedOrder] = useState("");
  /** How many leading rows are the curated head. Only meaningful in priority mode. */
  const [headCount, setHeadCount] = useState(0);
  /** Finding one game among two thousand rows. Priority mode only. */
  const [filter, setFilter] = useState("");
  const [meta, setMeta] = useState<Pick<Curation, "curated" | "updatedAt" | "updatedBy"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  // ── picker ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerResults, setPickerResults] = useState<JsGame[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  // ── tile image ──
  const [editing, setEditing] = useState<JsGame | null>(null);
  const [editIcon, setEditIcon] = useState("");
  const [savingIcon, setSavingIcon] = useState(false);

  const path = useMemo(
    () => buildPath(ENDPOINTS.casinoJsCuration.curation, { scope, key: curationKey }),
    [scope, curationKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /*
       * The catalogue pull is NOT wrapped in its own try/catch.
       *
       * It used to be, and the handler was empty. It asked for 1,000 rows
       * against a server cap of 100, so every load 400'd, and the empty catch
       * turned that into a board reading "0 games — not curated yet". A screen
       * that cannot say why it is empty is worse than one that shows an error.
       */
      const [res, catalogue] = await Promise.all([
        apiFetch<Curation>(path),
        priorityOverCatalogue
          ? apiFetch<JsGame[]>(ENDPOINTS.casinoJsCuration.search, { query: { q: "", limit: CATALOGUE_LIMIT } })
          : Promise.resolve<JsGame[]>([]),
      ]);

      const list = Array.isArray(res?.games) ? res.games : [];
      setMeta({ curated: res?.curated ?? false, updatedAt: res?.updatedAt ?? null, updatedBy: res?.updatedBy ?? null });

      if (priorityOverCatalogue) {
        const promoted = new Set(list.map((g) => g.game_uid));
        const tail = (Array.isArray(catalogue) ? catalogue : []).filter((g) => !promoted.has(g.game_uid));
        setGames([...list, ...tail]);
        setHeadCount(list.length);
      } else {
        setGames(list);
      }
      setSavedOrder(list.map((g) => g.game_uid).join(","));
    } catch (e: any) {
      setToast({ msg: e?.message || "Failed to load the list", sev: "error" });
      setGames([]);
      setHeadCount(0);
      setSavedOrder("");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [path, priorityOverCatalogue]);

  useEffect(() => {
    load();
  }, [load]);

  /* What a save would write. In priority mode the tail is the catalogue's own
     order, which the server supplies — only the head is ours to store. */
  const head = useMemo(
    () => (priorityOverCatalogue ? games.slice(0, headCount) : games),
    [games, headCount, priorityOverCatalogue]
  );

  /* The save button is enabled on a real difference, not on "has the user
     touched anything" — dragging a game down and back up again leaves nothing
     to save, and an enabled button there invites a pointless write. */
  const dirty = head.map((g) => g.game_uid).join(",") !== savedOrder;

  const atCap = priorityOverCatalogue && headCount >= MAX_PRIORITY;

  /* Reordering only ever happens inside the head — in priority mode the tail
     is the server's own id order, so an arrow there would move a row that
     comes straight back on the next load. */
  const move = (idx: number, dir: -1 | 1) =>
    setGames((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const moveTo = (idx: number, target: "top" | "bottom") =>
    setGames((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      if (target === "top") next.unshift(item);
      // "Bottom" means the bottom of the HEAD, not of two thousand rows: a
      // demoted game belongs at the end of the order, not lost in the tail.
      else if (priorityOverCatalogue) next.splice(headCount - 1, 0, item);
      else next.push(item);
      return next;
    });

  const removeAt = (idx: number) => setGames((prev) => prev.filter((_, i) => i !== idx));

  /** Tail → the end of the head. The one ordering action the tail offers. */
  const prioritise = (idx: number) => {
    if (idx < headCount || headCount >= MAX_PRIORITY) return;
    setGames((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(headCount, 0, item);
      return next;
    });
    setHeadCount((n) => n + 1);
  };

  /** Head → the top of the tail. The game keeps its place in the catalogue. */
  const deprioritise = (idx: number) => {
    if (idx >= headCount) return;
    setGames((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(headCount - 1, 0, item);
      return next;
    });
    setHeadCount((n) => Math.max(0, n - 1));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<Curation>(path, {
        method: "PUT",
        body: { gameUids: head.map((g) => g.game_uid) },
      });
      // Take the server's answer rather than assuming ours was applied: it
      // drops anything that left the catalogue between load and save, and the
      // operator should see that happen rather than discover it on the site.
      const list = Array.isArray(res?.games) ? res.games : head;

      if (priorityOverCatalogue) {
        // Rebuild head + tail from the answer, so a uid the server dropped
        // leaves the head instead of silently staying on screen.
        const promoted = new Set(list.map((g) => g.game_uid));
        setGames((prev) => [...list, ...prev.filter((g) => !promoted.has(g.game_uid))]);
        setHeadCount(list.length);
      } else {
        setGames(list);
      }

      setSavedOrder(list.map((g) => g.game_uid).join(","));
      setMeta({ curated: true, updatedAt: res?.updatedAt ?? null, updatedBy: res?.updatedBy ?? null });
      setToast({
        msg: priorityOverCatalogue
          ? `Saved — ${list.length} game${list.length === 1 ? "" : "s"} prioritised`
          : `Saved — ${list.length} game${list.length === 1 ? "" : "s"} live`,
        sev: "success",
      });
      onSaved?.();
    } catch (e: any) {
      setToast({ msg: e?.message || "Save failed", sev: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* ── picker ───────────────────────────────────────────────────── */

  const openPicker = () => {
    setPickerOpen(true);
    setPickerQ("");
    setPickerResults([]);
    setPickerSelected(new Set());
  };

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      setPickerLoading(true);
      try {
        const res = await apiFetch<JsGame[]>(ENDPOINTS.casinoJsCuration.search, {
          query: { q: pickerQ.trim(), limit: PICKER_LIMIT, ...pickerFilter },
        });
        setPickerResults(Array.isArray(res) ? res : []);
      } catch {
        setPickerResults([]);
      } finally {
        setPickerLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerQ, pickerOpen, pickerFilter?.vendor, pickerFilter?.type]);

  const alreadyIn = useMemo(() => new Set(games.map((g) => g.game_uid)), [games]);

  const addSelected = () => {
    const picked = pickerResults.filter((g) => pickerSelected.has(g.game_uid) && !alreadyIn.has(g.game_uid));
    setGames((prev) => [...prev, ...picked]);
    setPickerOpen(false);
  };

  /* ── tile image ───────────────────────────────────────────────── */

  const saveIcon = async () => {
    if (!editing) return;
    setSavingIcon(true);
    try {
      const updated = await apiFetch<JsGame>(
        buildPath(ENDPOINTS.casinoJsCuration.icon, { gameUid: editing.game_uid }),
        { method: "PUT", body: { icon: editIcon.trim() } }
      );
      setGames((prev) => prev.map((g) => (g.game_uid === updated.game_uid ? { ...g, game_icon: updated.game_icon } : g)));
      setEditing(null);
      setToast({ msg: "Tile image updated", sev: "success" });
    } catch (e: any) {
      setToast({ msg: e?.message || "Could not update the image", sev: "error" });
    } finally {
      setSavingIcon(false);
    }
  };

  /* ── what the table actually renders ──────────────────────────────
     Every row carries its REAL index in `games`, because the filter and the
     tail window both mean the rendered position is not the ordering position —
     and the move handlers address the underlying list. */
  const { visible, tailTotal } = useMemo(() => {
    const rows = games.map((game, idx) => ({ game, idx }));
    if (!priorityOverCatalogue) return { visible: rows, tailTotal: 0 };

    const q = filter.trim().toLowerCase();
    const matches = (g: JsGame) =>
      !q ||
      (g.game_name ?? "").toLowerCase().includes(q) ||
      (g.vendor ?? "").toLowerCase().includes(q) ||
      (g.game_type ?? "").toLowerCase().includes(q);

    const headRows = rows.slice(0, headCount).filter((r) => matches(r.game));
    const tailRows = rows.slice(headCount).filter((r) => matches(r.game));

    return { visible: [...headRows, ...tailRows.slice(0, TAIL_WINDOW)], tailTotal: tailRows.length };
  }, [games, headCount, filter, priorityOverCatalogue]);

  /** Where the "everything below here keeps the lobby's order" row goes. */
  const boundaryPos = priorityOverCatalogue ? visible.findIndex((r) => r.idx >= headCount) : -1;

  /* ── render ───────────────────────────────────────────────────── */

  return (
    <Paper sx={{ ...cardSx, p: 0, overflow: "hidden" }}>
      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid #1E2D55",
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ color: "#F9F9F9", fontWeight: 700 }}>{title}</Typography>
            <Chip
              size="small"
              label={`${games.length} game${games.length === 1 ? "" : "s"}`}
              sx={{ bgcolor: "#0B1427", color: "#8384A5", border: "1px solid #1E2D55", fontSize: "0.7rem" }}
            />
            {atCap && (
              <Chip
                size="small"
                label={`Priority list full (${MAX_PRIORITY})`}
                sx={{ bgcolor: "rgba(224,27,79,0.15)", color: "#E01B4F", fontSize: "0.7rem" }}
              />
            )}
            {dirty && (
              <Chip
                size="small"
                label="Unsaved"
                sx={{ bgcolor: "rgba(255,194,63,0.15)", color: "#FFC23F", fontSize: "0.7rem" }}
              />
            )}
          </Stack>
          <Typography sx={{ color: "#8384A5", fontSize: "0.76rem", mt: 0.5 }}>
            {subtitle ??
              (priorityOverCatalogue
                ? `${headCount} of ${games.length} prioritised${
                    meta?.updatedAt ? ` — last saved ${new Date(meta.updatedAt).toLocaleString()}` : ""
                  }`
                : meta?.updatedAt
                ? `Last saved ${new Date(meta.updatedAt).toLocaleString()}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}`
                : "Not curated yet — the lobby falls back to its default order")}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<RefreshCw size={14} />}
            onClick={load}
            disabled={loading}
            sx={{ color: "#8384A5" }}
          >
            Refresh
          </Button>
          {/* Every game is already on the board in priority mode, so there is
              nothing to add — what an operator needs there is to FIND one
              among two thousand rows. */}
          {priorityOverCatalogue ? (
            <TextField
              size="small"
              placeholder="Find a game…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ ...inputSx, width: 230 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={15} color="#8384A5" />
                  </InputAdornment>
                ),
              }}
            />
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Plus size={14} />}
              onClick={openPicker}
              sx={{ borderColor: "#1E2D55", color: "#F9F9F9" }}
            >
              Add games
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : <Save size={14} />}
            onClick={save}
            disabled={!dirty || saving}
          >
            Save order
          </Button>
        </Stack>
      </Box>

      <TableContainer sx={{ maxHeight: 620 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...thSx, width: 58 }}>#</TableCell>
              <TableCell sx={{ ...thSx, width: 64 }}>Tile</TableCell>
              <TableCell sx={thSx}>Game</TableCell>
              <TableCell sx={thSx}>Vendor</TableCell>
              <TableCell sx={thSx}>Type</TableCell>
              <TableCell sx={thSx}>Status</TableCell>
              <TableCell sx={{ ...thSx, width: 190, textAlign: "right" }}>Order</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ ...tdSx, textAlign: "center", py: 6 }}>
                  <CircularProgress size={22} sx={{ color: "#886CFF" }} />
                </TableCell>
              </TableRow>
            ) : games.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ ...tdSx, textAlign: "center", py: 6, color: "#8384A5" }}>
                  {priorityOverCatalogue
                    ? "The catalogue is empty — run the provider sync."
                    : "Nothing curated here yet. “Add games” picks from the live catalogue."}
                </TableCell>
              </TableRow>
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ ...tdSx, textAlign: "center", py: 6, color: "#8384A5" }}>
                  No game matches “{filter}”.
                </TableCell>
              </TableRow>
            ) : (
              visible.map(({ game, idx }, pos) => {
                const inHead = !priorityOverCatalogue || idx < headCount;
                const firstOfHead = idx === 0;
                const lastOfHead = priorityOverCatalogue ? idx === headCount - 1 : idx === games.length - 1;

                return (
                  <React.Fragment key={game.game_uid}>
                    {pos === boundaryPos && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          sx={{
                            ...tdSx,
                            bgcolor: "#0B1427",
                            borderTop: "1px solid #886CFF",
                            color: "#8384A5",
                            fontSize: "0.72rem",
                            py: 1,
                          }}
                        >
                          {headCount === 0
                            ? "Nothing is prioritised — the lobby shows every game in its default order. Use ⇧ to promote one."
                            : `↑ the ${headCount} above render first on the site — everything below keeps the lobby's default order`}
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow hover>
                      <TableCell sx={{ ...tdSx, color: inHead ? "#F9F9F9" : "#8384A5", fontVariantNumeric: "tabular-nums" }}>
                        {idx + 1}
                      </TableCell>
                      <TableCell sx={tdSx}>
                        <Avatar
                          src={game.game_icon || undefined}
                          variant="rounded"
                          sx={{ width: 40, height: 40, bgcolor: "#0B1427", border: "1px solid #1E2D55" }}
                        >
                          <ImageIcon size={15} color="#8384A5" />
                        </Avatar>
                      </TableCell>
                      <TableCell sx={{ ...tdSx, color: "#F9F9F9", fontWeight: 600 }}>{game.game_name}</TableCell>
                      <TableCell sx={tdSx}>{game.vendor || "—"}</TableCell>
                      <TableCell sx={tdSx}>{game.game_type || "—"}</TableCell>
                      <TableCell sx={tdSx}>
                        {/* An inactive game stays in the list but is filtered out of
                            the lobby response, so it is worth saying so here —
                            otherwise a curated tile is simply missing on the site
                            with nothing on this screen to explain it. */}
                        <Chip
                          size="small"
                          label={game.is_active === false ? "Hidden" : "Live"}
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            bgcolor: game.is_active === false ? "rgba(224,27,79,0.15)" : "rgba(14,204,104,0.15)",
                            color: game.is_active === false ? "#E01B4F" : "#0ECC68",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...tdSx, textAlign: "right", whiteSpace: "nowrap" }}>
                        {/* The tail has no order of its own — the server sorts it by
                            id — so the only thing to offer there is promotion. */}
                        {!inHead ? (
                          <Tooltip title={atCap ? `The priority list is full (${MAX_PRIORITY})` : "Prioritise — move into the ordered list"}>
                            <span>
                              <IconButton size="small" disabled={atCap} onClick={() => prioritise(idx)}>
                                <ChevronsUp size={14} color={atCap ? "#31385A" : "#886CFF"} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title="Move to top">
                              <span>
                                <IconButton size="small" disabled={firstOfHead} onClick={() => moveTo(idx, "top")}>
                                  <ChevronsUp size={14} color={firstOfHead ? "#31385A" : "#8384A5"} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Move up">
                              <span>
                                <IconButton size="small" disabled={firstOfHead} onClick={() => move(idx, -1)}>
                                  <ArrowUp size={14} color={firstOfHead ? "#31385A" : "#8384A5"} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Move down">
                              <span>
                                <IconButton size="small" disabled={lastOfHead} onClick={() => move(idx, 1)}>
                                  <ArrowDown size={14} color={lastOfHead ? "#31385A" : "#8384A5"} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={priorityOverCatalogue ? "Move to the end of the priority list" : "Move to bottom"}>
                              <span>
                                <IconButton size="small" disabled={lastOfHead} onClick={() => moveTo(idx, "bottom")}>
                                  <ChevronsDown size={14} color={lastOfHead ? "#31385A" : "#8384A5"} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Change tile image">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditing(game);
                              setEditIcon(game.game_icon || "");
                            }}
                          >
                            <Pencil size={14} color="#8384A5" />
                          </IconButton>
                        </Tooltip>
                        {/* A game cannot be removed from the catalogue here — in
                            priority mode the trash takes it out of the ORDER and
                            leaves it on the site, which is the only thing this
                            screen is entitled to do to it. */}
                        {inHead && (
                          <Tooltip title={priorityOverCatalogue ? "Remove from the priority list" : "Remove from this list"}>
                            <IconButton
                              size="small"
                              onClick={() => (priorityOverCatalogue ? deprioritise(idx) : removeAt(idx))}
                            >
                              <Trash2 size={14} color="#E01B4F" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}

            {/* The tail is windowed: two thousand MUI rows is a janky table, and
                an operator looking for one game should search for it. */}
            {priorityOverCatalogue && tailTotal > TAIL_WINDOW && (
              <TableRow>
                <TableCell colSpan={7} sx={{ ...tdSx, textAlign: "center", py: 2, color: "#8384A5" }}>
                  Showing {TAIL_WINDOW} of {tailTotal} unprioritised games — search above to find another.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── picker ── */}
      <Dialog open={pickerOpen} onClose={() => !pickerLoading && setPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: "#0E1831", color: "#F9F9F9", borderBottom: "1px solid #1E2D55" }}>
          Add games
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0E1831", pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Search the catalogue by name, vendor or type…"
            value={pickerQ}
            onChange={(e) => setPickerQ(e.target.value)}
            sx={{ ...inputSx, mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={15} color="#8384A5" />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ mt: 1.5, maxHeight: 380, overflowY: "auto" }}>
            {pickerLoading ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress size={20} sx={{ color: "#886CFF" }} />
              </Box>
            ) : pickerResults.length === 0 ? (
              <Typography sx={{ color: "#8384A5", fontSize: "0.8rem", py: 3, textAlign: "center" }}>
                No games match that search.
              </Typography>
            ) : (
              pickerResults.map((game) => {
                const already = alreadyIn.has(game.game_uid);
                return (
                  <Stack
                    key={game.game_uid}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      opacity: already ? 0.45 : 1,
                      "&:hover": { bgcolor: already ? "transparent" : "#0B1427" },
                    }}
                  >
                    <Checkbox
                      size="small"
                      disabled={already}
                      checked={pickerSelected.has(game.game_uid)}
                      onChange={(e) =>
                        setPickerSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(game.game_uid);
                          else next.delete(game.game_uid);
                          return next;
                        })
                      }
                    />
                    <Avatar
                      src={game.game_icon || undefined}
                      variant="rounded"
                      sx={{ width: 34, height: 34, bgcolor: "#0B1427", border: "1px solid #1E2D55" }}
                    >
                      <ImageIcon size={13} color="#8384A5" />
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ color: "#F9F9F9", fontSize: "0.82rem", fontWeight: 600 }}>
                        {game.game_name}
                      </Typography>
                      <Typography sx={{ color: "#8384A5", fontSize: "0.7rem" }}>
                        {game.vendor || "—"} · {game.game_type || "—"}
                        {already ? " · already in this list" : ""}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#0E1831", borderTop: "1px solid #1E2D55", px: 2, py: 1.5 }}>
          <Button onClick={() => setPickerOpen(false)} sx={{ color: "#8384A5" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={addSelected} disabled={pickerSelected.size === 0}>
            Add {pickerSelected.size || ""}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── tile image ── */}
      <Dialog open={Boolean(editing)} onClose={() => !savingIcon && setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: "#0E1831", color: "#F9F9F9", borderBottom: "1px solid #1E2D55" }}>
          Tile image
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0E1831", pt: 2 }}>
          <Typography sx={{ color: "#8384A5", fontSize: "0.78rem", mb: 1.5, mt: 1 }}>
            {editing?.game_name}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Image URL"
            value={editIcon}
            onChange={(e) => setEditIcon(e.target.value)}
            sx={inputSx}
          />
          {editIcon.trim() && (
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <Avatar
                src={editIcon.trim()}
                variant="rounded"
                sx={{ width: 96, height: 128, bgcolor: "#0B1427", border: "1px solid #1E2D55" }}
              >
                <ImageIcon size={20} color="#8384A5" />
              </Avatar>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#0E1831", borderTop: "1px solid #1E2D55", px: 2, py: 1.5 }}>
          <Button onClick={() => setEditing(null)} sx={{ color: "#8384A5" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveIcon} disabled={savingIcon || !editIcon.trim()}>
            {savingIcon ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast?.sev ?? "success"} variant="filled" onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default CurationBoard;
