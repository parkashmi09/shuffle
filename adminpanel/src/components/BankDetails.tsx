import React, { useEffect, useState } from "react";
import {
  Box, Card, CardHeader, CardContent, Button, Grid,
  TextField, Snackbar, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
  Stack, Typography
} from "@mui/material";
import {
  Add as AddIcon, Edit as EditIcon, Delete as DelIcon,
  Close as CloseIcon, Clear as ClearIcon
} from "@mui/icons-material";
import { Buffer } from "buffer";
import { API_BASE_URL } from '../utils/api';

/* ─────────── config ─────────── */
const COIN = "INR";
const API = API_BASE_URL;
const END_PT = `/bankdetails/${COIN}`;

/* staff-id stored by the auth flow */


/* ─────────── helpers ─────────── */
const buf2b64 = (b: any) =>
  !b
    ? ""
    : typeof b === "string"
      ? b
      : Buffer.from(b.data).toString("base64");

interface Detail {
  id: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  upi_id: string;
  qr_image: any;
}

/** GET helper with x-staff-id header */
const fetchJSON = async <T,>(url: string, opts: RequestInit = {}) => {
  const staffId = localStorage.getItem("currentUserId") || "";   // empty ⇒ header omitted
  const res = await fetch(`${API}${url}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(staffId ? { "x-staff-id": staffId } : {})
    }
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return (await res.json()) as T;
};

/* ─────────── component ─────────── */
const BankDetailsAdmin: React.FC = () => {
  const [list, setList] = useState<Detail[]>([]);
  const [load, setLoad] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const staffId = localStorage.getItem("currentUserId") || "";   // empty ⇒ header omitted
  /* form */
  const [editId, setEditId] = useState<number | null>(null);
  const blank = {
    bank_name: "", account_number: "", ifsc_code: "",
    account_holder_name: "", upi_id: "", qr_image: null as File | null
  };
  const [form, setForm] = useState({ ...blank });
  const [preview, setPreview] = useState("");

  /* delete dialog */
  const [delId, setDelId] = useState<number | null>(null);

  /* -------- load list */
  const refresh = async () => {
    try {
      setLoad(true);
      const rows = await fetchJSON<Detail[]>(END_PT);
      setList(rows);
    } catch (e: any) { setErr(e.message || "Server error"); }
    finally { setLoad(false); }
  };
  useEffect(() => { refresh(); }, []);

  /* -------- helpers */
  const reset = () => { setEditId(null); setForm({ ...blank }); setPreview(""); };
  const pick = (d: Detail) => {
    setEditId(d.id);
    setForm({
      bank_name: d.bank_name, account_number: d.account_number,
      ifsc_code: d.ifsc_code, account_holder_name: d.account_holder_name,
      upi_id: d.upi_id, qr_image: null
    });
    setPreview(d.qr_image ? `data:image/png;base64,${buf2b64(d.qr_image)}` : "");
  };
  const chooseFile = (f: File | null) => {
    if (!f) return;
    setForm(p => ({ ...p, qr_image: f }));
    const r = new FileReader();
    r.onloadend = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  };

  /* -------- save (POST / PUT) */
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoad(true);
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (!v || k === "qr_image") return;
        fd.append(k, v as string);
      });
      if (form.qr_image) fd.append("qr_image", form.qr_image);

      await fetch(`${API}${END_PT}${editId ? `/${editId}` : ""}`, {
        method: editId ? "PUT" : "POST",
        body: fd,
        headers: staffId ? { "x-staff-id": staffId } : undefined
      });
      reset(); refresh();
    } catch (e: any) { setErr(e.message || "Save failed"); }
    finally { setLoad(false); }
  };

  /* -------- delete (soft) */
  const del = async () => {
    if (!delId) return;
    try {
      setLoad(true);
      await fetch(`${API}${END_PT}/${delId}`, {
        method: "DELETE",
        headers: staffId ? { "x-staff-id": staffId } : undefined
      });
      setDelId(null); refresh();
    } catch (e: any) { setErr(e.message || "Delete failed"); }
    finally { setLoad(false); }
  };

  /* ------------------------------------------------ render */
  return (
    <div className="p-2">
      <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: 1200, mx: "auto" }}>
        <Card elevation={3}>
          {load && <LinearProgress />}
          <CardHeader
            title={<Typography variant="h6">Bank Details – {COIN}</Typography>}
            action={editId === null && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditId(0)}>
                Add New
              </Button>
            )}
          />

          <CardContent>
            {err && (
              <Snackbar open autoHideDuration={6000} onClose={() => setErr(null)}>
                <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>
              </Snackbar>
            )}

            {/* ---------- form ---------- */}
            {editId !== null && (
              <Box component="form" onSubmit={save} sx={{ mb: 4 }}>
                <Grid container spacing={2}>
                  {[
                    ["Bank Name", "bank_name"],
                    ["Account Number", "account_number"],
                    ["IFSC Code", "ifsc_code"],
                    ["Account Holder", "account_holder_name"],
                    ["UPI ID", "upi_id"]
                  ].map(([label, key]) => (
                    <Grid key={key} item xs={12} md={6}>
                      <TextField
                        label={label as string} required fullWidth disabled={load}
                        value={(form as any)[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                    </Grid>
                  ))}

                  {/* QR picker */}
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button component="label" variant="outlined" disabled={load} fullWidth>
                        {form.qr_image ? "Change QR" : "Upload QR"}
                        <input hidden type="file" accept="image/*"
                          onChange={e => chooseFile(e.target.files?.[0] || null)} />
                      </Button>
                      {preview && (
                        <Box sx={{ position: "relative" }}>
                          <img src={preview} alt="QR"
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }} />
                          <IconButton size="small"
                            sx={{ position: "absolute", top: -10, right: -10 }}
                            onClick={() => { setForm(p => ({ ...p, qr_image: null })); setPreview(""); }}>
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Stack>
                  </Grid>

                  {/* actions */}
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button variant="outlined" startIcon={<CloseIcon />} onClick={reset} disabled={load}>
                        Cancel
                      </Button>
                      <Button variant="contained" type="submit" disabled={load}>
                        {editId ? "Update" : "Save"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* ---------- table ---------- */}
            <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {["Bank", "Account", "IFSC", "Holder", "UPI ID", "QR", ""].map(h => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : list.map(d => (
                    <TableRow hover key={d.id}>
                      <TableCell>{d.bank_name}</TableCell>
                      <TableCell>{d.account_number}</TableCell>
                      <TableCell>{d.ifsc_code}</TableCell>
                      <TableCell>{d.account_holder_name}</TableCell>
                      <TableCell>{d.upi_id}</TableCell>
                      <TableCell>
                        {d.qr_image && (
                          <img
                            src={`data:image/png;base64,${buf2b64(d.qr_image)}`}
                            alt="QR"
                            style={{ width: 48, height: 48, objectFit: "cover" }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => pick(d)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => setDelId(d.id)}>
                          <DelIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* delete dialog */}
        <Dialog open={delId !== null} onClose={() => setDelId(null)}>
          <DialogTitle>Delete Confirmation</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Delete this record? This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDelId(null)}>Cancel</Button>
            <Button color="error" onClick={del} disabled={load}>Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </div>
  );
};

export default BankDetailsAdmin;
