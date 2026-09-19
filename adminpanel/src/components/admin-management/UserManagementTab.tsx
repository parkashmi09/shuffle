
import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from "react";
import { 
  Edit, Trash2, Eye, EyeOff, Shield, UserPlus, Search, Filter,
  CheckCircle, X, Copy,
  Users
} from "lucide-react";
import { Alert, AlertColor, Snackbar } from "@mui/material";
import { apiFetch, buildPath } from "../../utils/api";
import { ENDPOINTS } from "../../services/endpoints";


/* ──────────────────────────────────────────────────────────────────────────
   Shared types
   ────────────────────────────────────────────────────────────────────────── */
export interface StaffRow {
  id        : number;
  firstName : string;
  lastName  : string;
   phone     : string;          // <— new
   country   : string;  
  email     : string;
  username  : string;
  role      : "SuperAdmin" | "Admin" | "SubAdmin" | "Master" | "Agent" | "SubAgent" | "User";
  status    : "active" | "inactive";
  balance   : number;
  parent_id : number | null;
  lastLogin?: string;
  createdAt?: string;
    wa_slug ?: string;   //  ← add
  wa_phone?: string;   //  ← add
  percentage: string; 
}

interface SnackbarState {
  open  : boolean;
  message: string;
  severity: AlertColor;
}

interface DeleteConfirmState {
  open      : boolean;
  staffId   : number | null;
  staffName : string;
}

interface FormState {
  firstName      : string;
  lastName       : string;
  email          : string;
  username       : string;
  role           : StaffRow["role"];
  password       : string;
  confirmPassword: string;
   phone          : string;
  country        : string;
  parentId       : number | "";   // "" shown in <select> for “no parent”
   percentage: string; 
}

/* Role hierarchy map (unchanged UI colours) */
export const ROLE_HIERARCHY = {
  SuperAdmin : { level: 0, color: "bg-black",      description: "Supreme admin access" },
  Admin      : { level: 1, color: "bg-[#E01B4F]",    description: "Full system access" },
  SubAdmin   : { level: 2, color: "bg-orange-500", description: "Limited admin access" },
  Master     : { level: 3, color: "bg-[#886CFF]",   description: "Master level control" },
  Agent      : { level: 4, color: "bg-[#0ECC68]",  description: "Agent operations" },
  SubAgent   : { level: 5, color: "bg-purple-500", description: "Basic operations" },
  User       : { level: 6, color: "bg-[#1E2D55]",   description: "Standard user access" }
} as const;
const toArray = (res: any) =>
  Array.isArray(res)            ? res :
  Array.isArray(res.data)       ? res.data :
  Array.isArray(res.staff)      ? res.staff :
  [];
/* ────────────────────────────────────────────────────────────────
  1.  Helper – turn whatever the backend sends into our StaffRow
  ──────────────────────────────────────────────────────────────── */
const normalise = (raw: any): StaffRow => {
 const [first = "", ...rest] = (raw.name ?? "").trim().split(" ");
 return {
   id        : raw.id,
   firstName : first,
   lastName  : rest.join(" "),
   email     : raw.email ?? "",
   username  : raw.username                                // may exist already
               ?? (raw.email ? raw.email.split("@")[0] : ""), // fallback
   role      : raw.role ?? "User",
   status    : raw.status ?? "active",
   balance   : raw.inr ?? raw.balance ?? 0,
   parent_id : raw.parent_id ?? null,
   phone     : raw.phone ?? "",
   country   : raw.country ?? "",
    wa_slug  : raw.wa_slug  ?? null,
 wa_phone : raw.wa_phone ?? null,
 percentage:raw.percentage ?? ""
 };
};
/* --------------- copy helper ------------------ */

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────────────────── */
export default function UserManagementTab() {
  /* ---------------- state ---------------- */
  const [staff,   setStaff]   = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm]        = useState(false);
  const [editingId, setEditingId]      = useState<number|null>(null);

  const [form, setForm] = useState<FormState>({
    firstName:"", lastName:"", email:"", username:"",
    role:"User", password:"", confirmPassword:"", parentId:"", phone    : "",
   country  : "", percentage:""
  });
  const [formErrors, setFormErrors]    = useState<Record<string,string>>({});

  const [search, setSearch]            = useState("");
  const [roleFilter, setRoleFilter]    = useState<string>("all");
  const [statusFilter, setStatusFilter]= useState<string>("all");

  const [showPwd, showPwdSet]          = useState(false);
  const [showPwd2, showPwd2Set]        = useState(false);

  const [snack, setSnack]              = useState<SnackbarState>({open:false,message:"",severity:"success"});

  const [delDlg, setDelDlg]            = useState<DeleteConfirmState>({open:false,staffId:null,staffName:""});
const [tree , setTree ]   = useState<any[]>([]);
const [showTree, setShowTree] = useState(false);
  /* ⤵ current user basics pulled from localStorage */
  const myRole      = (localStorage.getItem("userRole") ??
                     "User") as keyof typeof ROLE_HIERARCHY;
  const myLevel     = ROLE_HIERARCHY[myRole].level;

  /* ---------------- fetch initial list ---------------- */
  useEffect(() => {
    (async () => {
      try {
        /* 2. normalise every row coming from the server */
        const data = await apiFetch<any[]>(ENDPOINTS.staff.list);
        await apiFetch<any[]>(ENDPOINTS.staff.tree);
       setStaff(toArray(data).map(normalise));
      } catch (err:any) {
        console.error(err);
        setSnack({open:true,message:err.message||"Server error",severity:"error"});
      } finally {
        setLoading(false);
      }
    })();
  }, []);
const copy = async (txt: string) => {
 try {
   await navigator.clipboard.writeText(txt);
   setSnack({ open:true, message:"Copied to clipboard ✔", severity:"success" });
 } catch {
   setSnack({ open:true, message:"Couldn't copy", severity:"error" });
 }
};
  /* ---------------- derived helpers ---------------- */
  const manageableRoles = useMemo(() =>
    Object.keys(ROLE_HIERARCHY).filter(r => ROLE_HIERARCHY[r as keyof typeof ROLE_HIERARCHY].level > myLevel)
  ,[myLevel]);

const nameById = useMemo(() => {
  const map: Record<number,string> = {};
  staff.forEach(r => { map[r.id] = r.username || `${r.firstName} ${r.lastName}`; });
  return map;
}, [staff]);
  /* who can be chosen as parent in the <select>? */
  const parentOptions = useMemo(() =>
    staff.filter(s =>
      ROLE_HIERARCHY[s.role].level < ROLE_HIERARCHY[form.role].level)
,[staff, form.role]);

  /* rows that pass hierarchy & filters */
  const visibleRows = useMemo(() => staff.filter(s => {
    if (!manageableRoles.includes(s.role)) return false;

    const matchesSearch =
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.username.toLowerCase().includes(search.toLowerCase()) ||
   s.phone.toLowerCase().includes(search.toLowerCase())   ||
    s.country.toLowerCase().includes(search.toLowerCase());

    const matchesRole   = roleFilter === "all"   || s.role   === roleFilter;
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }), [staff, manageableRoles, search, roleFilter, statusFilter]);

  /* ---------------- form helpers ---------------- */
  const resetForm = () => {
    setForm({ firstName:"", lastName:"", email:"", username:"",
              role:"User", password:"", confirmPassword:"", parentId:"" ,phone:"", country:"", percentage:"" });
    setFormErrors({});
    setEditingId(null);
    setShowForm(false);
    showPwdSet(false); showPwd2Set(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log("handleChange", name, value);
    setForm(f => ({ ...f, [name]: value }));
    if (formErrors[name]) setFormErrors(err => ({ ...err, [name]:"" }));
  };

  const validate = () => {
    const err: Record<string,string> = {};
    if (!form.firstName.trim())          err.firstName = "First name required";
    if (!form.lastName.trim())           err.lastName  = "Last name required";
    if (!form.email.trim())              err.email     = "Email required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) err.email = "Invalid email";
    if (!form.username.trim())           err.username  = "Username required";
    if (!editingId && !form.password)    err.password  = "Password required";
    if (form.password !== form.confirmPassword) err.confirmPassword = "Passwords don’t match";
    if (form.parentId === "" && form.role !== "SuperAdmin" && myRole !== "SuperAdmin")
      err.parentId = "Choose parent";
   if (!form.phone.trim())       err.phone   = "Phone is required";
 if (!form.country.trim())     err.country = "Country is required";
  if (form.role !== "User") {
  if (form.percentage.trim() === "") err.percentage = "Percentage required";
  else if (+form.percentage < 0 || +form.percentage > 100)
    err.percentage = "0 – 100 only";
}
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };


/**
 * Full, drop-in replacement for the old `handleSubmit`
 * — works for **staff** (`/api/staff`) *and* players (`/api/staff/players`)
 * — obeys hierarchy rules
 * — refreshes the list and shows a snackbar
 */
/* ───────────────────────────────────────────────────────── handleSubmit */
const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
  /* 1 . client-side validation */
  if (!validate()) return;

  /* 2 . decide where we’re sending the request */
  const isPlayer  = form.role === "User";     // ↺ level 6
  // const baseURL   = isPlayer ? "/api/staff/players"
  //                            : "/api/staff";
  // const method    = editingId ? "PATCH" : "POST";
  // const url       =
  //       editingId && !isPlayer   // players can only be created, not PATCH’ed
  //         ? `${baseURL}/${editingId}`
  //         : baseURL;
const baseURL = isPlayer ? ENDPOINTS.players.create : ENDPOINTS.staff.list;
const method  = editingId ? "PATCH" : "POST";
const url     = editingId ? `${baseURL}/${editingId}` : baseURL;

  /* 3 . build the BODY in the *exact order* each controller expects */
  const common = {
    /* ORDER for both payloads is identical after the first field(s) */
    email          : form.email,
    phone          : form.phone || null,
    country        : form.country || null,
    password       : form.password || undefined,
    initial_balance: 0,
    parent_id : form.parentId === "" ? null : Number(form.parentId),
  };


  const playerBody = {
    username: form.username,
    ...common                     // email, phone, …
  };


  const staffBody = {
    name      : `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    email     : common.email,
    phone     : common.phone,
    country   : common.country,
    password  : common.password,
    role_name : form.role,                       // "Admin" | "SubAdmin" | …
    initial_balance: common.initial_balance,
    parent_id : form.parentId === "" ? null : Number(form.parentId),
    percentage: form.role === "User" ? undefined : Number(form.percentage || 0)
  };

  const body = isPlayer ? playerBody : staffBody;

  /* 4 . fire the request */
  try {
    await apiFetch(url, { method, body: JSON.stringify(body) });

    setSnack({
      open    : true,
      severity: "success",
      message : editingId ? "Client updated" : "Client created"
    });

    /* 5 . refresh list so the UI matches DB */
    const fresh = await apiFetch<any[]>(ENDPOINTS.staff.list);
  setStaff(toArray(fresh).map(normalise));

    resetForm();
      window.location.reload(); // reload to refresh the list
  } catch (err: any) {
    console.error(err);
    setSnack({
      open    : true,
      severity: "error",
      message : err?.message || "Server error"
    });
  }
};
  /* ---------------- edit / delete ---------------- */
  const startEdit = (row: StaffRow) => {
    setEditingId(row.id);
    setForm({
      firstName: row.firstName,
      lastName : row.lastName,
      email    : row.email,
      username : row.username,
      role     : row.role,
      password : "",
      confirmPassword:"",
      parentId : row.parent_id ?? "",
      phone    : row.phone || "",
      country  : row.country || "",
      percentage:row.percentage || ""
    });
    setShowForm(true);
  };

  // const confirmDelete = async () => {
  //   if (!delDlg.staffId) return;
  //   try {
  //     await apiFetch(`/api/staff/${delDlg.staffId}`, { method:"DELETE" });
  //     setStaff(prev => prev.filter(s => s.id !== delDlg.staffId));
  //     setSnack({open:true,message:"Deleted",severity:"success"});
  //   } catch (err:any) {
  //     setSnack({open:true,message:err.message||"Server error",severity:"error"});
  //   } finally {
  //     setDelDlg({open:false,staffId:null,staffName:""});
  //   }
  // };
const confirmDelete = async () => {
  if (!delDlg.staffId) return;

  const row = staff.find(r => r.id === delDlg.staffId);
  if (!row) return;

  try {
    const path = row.role === "User"
      ? buildPath(ENDPOINTS.players.close, { playerId: row.id })
      : buildPath(ENDPOINTS.staff.remove, { staffId: row.id });

    await apiFetch(path, { method:"DELETE" });

    setStaff(prev => prev.filter(s => s.id !== row.id));
    setSnack({ open:true, message:"Deleted", severity:"success" });
  } catch (err:any) {
    setSnack({ open:true, message:err.message || "Server error", severity:"error" });
  } finally {
    setDelDlg({ open:false, staffId:null, staffName:"" });
    window.location.reload(); // reload to refresh the list
  }
};

  /* ---------------- status toggle ---------------- */
  const toggleStatus = async (row: StaffRow) => {
    const newStatus = row.status === "active" ? "inactive" : "active";
    /* optimistic UI */
    setStaff(prev => prev.map(s => s.id === row.id ? {...s,status:newStatus} : s));
    try {
      await apiFetch(buildPath(ENDPOINTS.staff.update, { staffId: row.id }), { method:"PATCH", body:JSON.stringify({ status:newStatus }) });
    } catch (err) {
      /* revert on failure */
      setStaff(prev => prev.map(s => s.id === row.id ? row : s));
      setSnack({open:true,message:"Couldn’t change status",severity:"error"});
    }
  };

  /* ---------------- render ---------------- */
  if (loading)
    return <div className="text-center py-16 text-[#878AA2] bg-[#0C0D1D]">Loading…</div>;

  if (manageableRoles.length === 0)
    return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="w-16 h-16 text-[#878AA2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#F9F9F9] mb-2">No Management Access</h3>
          <p className="text-[#878AA2]">
            Your role ({myRole}) does not have permission to manage other users.
          </p>
        </div>
      </div>
    );

  /* =======================================================================
     UI below is almost byte-for-byte your original – only minimal additions
     ======================================================================= */
  return (
    <div className="p-2 max-w-7xl mx-auto">
      {/* Controls */}
      <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* left side */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2] w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF] focus:border-transparent"
              />
            </div>

            {/* role filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2] w-5 h-5" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
              >
                <option value="all">All Roles</option>
                {manageableRoles.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            {/* status filter */}
            <div className="relative">
              <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878AA2] w-5 h-5" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* add */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-[#886CFF] text-[#F9F9F9] rounded-lg hover:bg-[#9B82FF] transition"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Client
          </button>
          <button
 onClick={async () => {
   /* fetch only once per session */
   if (!tree.length) {
     const t :any= await apiFetch<any[]>(ENDPOINTS.staff.tree);
     setTree(Array.isArray(t.data) ? t.data : t);
   }
   setShowTree(true);
 }}
 className="flex items-center px-4 py-2 bg-[#162140] text-[#F9F9F9] rounded-lg hover:bg-[#1E2D55] transition border border-[#1E2D55]"
 title="Show hierarchy tree"
>
 <Shield className="w-4 h-4 mr-2"/>
 Hierarchy
</button>

        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0C0D1D]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Client Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Phone</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase"> Percentage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Under</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#878AA2] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-[#0E1831] divide-y divide-[#1E2D55]">
              {visibleRows.map(r => (
                <tr key={r.id} className="hover:bg-[#162140]">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[#F9F9F9]">{r.email}</div>
                    <div className="text-xs text-[#878AA2]">@{r.username}</div>
                  </td>
                  <td className="px-6 py-4">
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-[#F9F9F9] ${ROLE_HIERARCHY[r.role].color}`}>
                      {r.role}
                    </span>
                  </td>
                  {/* phone / country */}
<td className="px-6 py-4">
  {r.phone ? (
    <div className="flex items-center space-x-2 text-sm text-[#F9F9F9]">
      <span>{r.phone}</span>
      <button
        onClick={() => copy(r.phone)}
        className="text-[#878AA2] hover:text-[#8384A5]"
        title="Copy phone"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <span className="text-xs text-[#878AA2]">—</span>
  )}
</td>
       { r.percentage?(<td className="px-6 py-4 font-mono text-sm text-[#F9F9F9]">{r.percentage}%</td>):(<td className="px-6 py-4 font-mono text-sm text-[#878AA2]">-</td>)}


                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(r)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${"bg-[#0ECC68]/20 text-[#0ECC68]"}`}
                    >
                      {<CheckCircle className="w-3 h-3 mr-1"/>}
                      {r.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-[#F9F9F9]">{r.balance}</td>
                                   <td className="px-6 py-4 text-sm text-[#878AA2]">
                {r.parent_id ? nameById[r.parent_id] ?? "--" : "--"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <button onClick={() => startEdit(r)} className="text-[#886CFF] hover:text-[#9B82FF] p-1 rounded-full hover:bg-[#886CFF]/20">
                        <Edit className="w-4 h-4"/>
                      </button>
                      <button onClick={() => setDelDlg({open:true,staffId:r.id,staffName:`${r.firstName} ${r.lastName}`})}
                              className="text-[#E01B4F] hover:text-[#E01B4F] p-1 rounded-full hover:bg-[#E01B4F]/20">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleRows.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-[#878AA2] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#F9F9F9] mb-2">No clients found</h3>
            <p className="text-[#878AA2]">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>
    

   {/* ────────────────────────────────────────────────────────────
     Hierarchy modal  – pretty, collapsible tree
     ( put this exactly where the old <div>…modal…</div> lived )
   ──────────────────────────────────────────────────────────── */}
{showTree && (
  <div
    className="fixed inset-0 flex items-center justify-center z-[11000]
               bg-gradient-to-b from-black/70 to-black/90 px-4"
    onClick={() => setShowTree(false)}
        >
          <div 
      className="bg-[#0E1831] rounded-2xl w-full max-w-6xl
                 max-h-[90vh] overflow-auto p-6 border border-[#1E2D55]"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#F9F9F9] flex items-center">
          <Users className="w-6 h-6 text-[#886CFF] mr-3" />
          Organisation Chart
              </h2>
              <button
          onClick={() => setShowTree(false)}
          className="p-2 hover:bg-[#162140] rounded-lg transition-colors duration-200"
        >
          <svg className="w-6 h-6 text-[#878AA2] hover:text-[#8384A5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Flowchart Tree Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
        <div className="min-w-max p-4">
          {(() => {
            /* A single node coming back from `/api/staff/tree` */
            interface TreeItem {
              id        : number;
              name      : string;
              role      : keyof typeof ROLE_HIERARCHY;
              depth     : number;
              parent_id?: number | null;
            }

            const idSet     = new Set<number>(tree.map((n:TreeItem) => n.id));
const byParent: Record<number | "root", TreeItem[]> = { root: [] };

tree.forEach((n: TreeItem) => {
  /* if parent_id == null   ⇒ top-level
     if parent_id not in idSet ⇒ also treat as top-level               */
  const key: number | "root" =
    n.parent_id == null || !idSet.has(n.parent_id) ? "root" : n.parent_id;

  if (!byParent[key]) byParent[key] = [];
  byParent[key].push(n);
});

            /* Flowchart Node Component */
            const FlowchartNode: React.FC<{ node: TreeItem; isRoot?: boolean }> = ({ node, isRoot = false }) => {
              const kids = byParent[node.id] || [];
              const [open, setOpen] = React.useState(true);
              const roleConfig = ROLE_HIERARCHY[node.role] || { color: "bg-[#878AA2]" };

              return (
                <div className="flex flex-col items-center">
                  {/* Node Card */}
                  <div className="relative group">
                    <div
                      className={`
                        ${roleConfig.color} text-[#F9F9F9]
                        px-3 py-2 rounded-lg border border-[#1E2D55]
                        min-w-[140px] text-center cursor-pointer
                        transform transition-all duration-200
                        hover:scale-105 hover:border-[#886CFF]
                        ${kids.length > 0 ? 'cursor-pointer' : ''}
                        ${isRoot ? 'ring-2 ring-[#886CFF]/40' : ''}
                      `}
                      onClick={() => kids.length && setOpen(!open)}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <div className="font-medium text-xs truncate max-w-[100px]">
                          {node.name}
                        </div>
                        {kids.length > 0 && (
                          <svg
                            viewBox="0 0 20 20"
                            className={`w-3 h-3 transition-transform duration-200 ${
                              open ? "rotate-90" : ""
                            }`}
                            fill="currentColor"
                          >
                            <path d="M6 6L14 10L6 14V6Z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-[10px] opacity-90 mt-0.5 font-medium">
                        {node.role}
                      </div>
                      
                      {/* Employee count badge */}
                      {kids.length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-[#886CFF] text-[#F9F9F9]
                                      text-[10px] rounded-full w-4 h-4 flex items-center justify-center
                                      font-bold">
                          {kids.length}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vertical Connector Line */}
                  {kids.length > 0 && open && (
                    <div className="w-0.5 h-4 bg-gradient-to-b from-gray-500 to-gray-600 my-1"></div>
                  )}

                  {/* Children Container */}
                  {kids.length > 0 && open && (
                    <div className="relative">
                      {/* Horizontal Connector Line */}
                      {kids.length > 1 && (
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 
                                      w-full h-0.5 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                      )}
                      
                      {/* Children Grid */}
                      <div className="flex flex-wrap justify-center gap-4 pt-2">
                        {kids.map((child, index) => (
                          <div key={child.id} className="relative">
                            {/* Individual Vertical Connector */}
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 
                                          w-0.5 h-2 bg-gradient-to-b from-gray-600 to-transparent -mt-2"></div>
                            <FlowchartNode node={child} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            /* Root render with enhanced styling */
            return (
              <div className="flex justify-center min-h-[300px] bg-[#0C0D1D]
                            rounded-xl p-6 border border-[#1E2D55]">
                <div className="space-y-4">
                  {(byParent.root || []).map(rootNode => (
                    <FlowchartNode key={rootNode.id} node={rootNode} isRoot={true} />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[#1E2D55]">
        <h3 className="text-sm font-medium text-[#878AA2] mb-3">Role Legend:</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLE_HIERARCHY).map(([role, config]) => (
            <div key={role} className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded ${config.color}`}></div>
              <span className="text-sm text-[#878AA2]">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

      {/* ------------------------------------------------------------------
         Add / Edit Modal (showForm) – unchanged layout, extra parent picker
         ------------------------------------------------------------------ */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[9999]" onClick={resetForm}>
          <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>

            {/* header */}
            <div className="flex items-center justify-between p-6 border-b border-[#1E2D55]">
              <h2 className="text-xl font-semibold text-[#F9F9F9]">
                {editingId ? "Edit Client" : "Add New Client"}
              </h2>
              <button onClick={resetForm} className="text-[#878AA2] hover:text-[#8384A5] p-1 rounded-full hover:bg-[#162140]">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* body */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* firstName */}
              <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">First Name *</label>
                    <input name="firstName" value={form.firstName} onChange={handleChange}
                      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                      placeholder="First name"/>
                    {formErrors.firstName && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.firstName}</p>}
              </div>

                  {/* lastName */}
              <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">Last Name *</label>
                    <input name="lastName" value={form.lastName} onChange={handleChange}
                      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                      placeholder="Last name"/>
                    {formErrors.lastName && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.lastName}</p>}
              </div>

                  {/* email */}
                  <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">Email *</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange}
                      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                      placeholder="Email"/>
                    {formErrors.email && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.email}</p>}
                  </div>

                  {/* username */}
                  <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">Username *</label>
                    <input name="username" value={form.username} onChange={handleChange}
                      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                      placeholder="Username"/>
                    {formErrors.username && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.username}</p>}
                  </div>

                  {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-2">
    Phone&nbsp;*
                </label>
                <input
    type="text"
    name="phone"
    value={form.phone}
    onChange={handleChange}
    className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9]
               focus:ring-2 focus:ring-[#886CFF] focus:border-transparent"
    placeholder="Enter phone number"
  />
  {formErrors.phone && (
    <p className="text-[#E01B4F] text-sm mt-1">{formErrors.phone}</p>
                )}
              </div>

{/* Country */}
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-2">
    Country&nbsp;*
                </label>
                <input
                  type="text"
    name="country"
    value={form.country}
    onChange={handleChange}
    className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9]
               focus:ring-2 focus:ring-[#886CFF] focus:border-transparent"
    placeholder="IN / US / …"
  />
  {formErrors.country && (
    <p className="text-[#E01B4F] text-sm mt-1">{formErrors.country}</p>
                )}
              </div>


                  {/* role */}
                  <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">Role *</label>
                    <select name="role" value={form.role} onChange={handleChange}
                      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]">
                      {manageableRoles.map(r => (
                        <option key={r} value={r}>{r} — {ROLE_HIERARCHY[r as keyof typeof ROLE_HIERARCHY].description}</option>
                      ))}
                    </select>
                  </div>

                  {/* parent picker (only when creating & not SuperAdmin root) */}
                  {!editingId && (
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-2">
                        Place under *
                </label>
                      <select name="parentId" value={form.parentId} onChange={handleChange}
                        className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]">
                            {/* Super-admin still gets the “top level” option.
      Everyone else gets “— Myself —” instead. */}
     {myRole === "SuperAdmin"
       ? <option value="">— Top level —</option>
       : <option value="">— Select —</option>}
                        {parentOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.firstName} {p.lastName} ({p.role})
                      </option>
                        ))}
                </select>
                      {formErrors.parentId && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.parentId}</p>}
              </div>
                  )}

                  {/* password */}
              <div>
                <label className="block text-sm font-medium text-[#8384A5] mb-2">
                      {editingId ? "New Password" : "Password"} {editingId ? "(leave blank to keep)" : "*"}
                </label>
                <div className="relative">
                  <input
                        type={showPwd ? "text" : "password"} name="password"
                        value={form.password} onChange={handleChange}
                        className="w-full px-3 py-2 pr-10 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                        placeholder="Password"/>
                      <button type="button" onClick={() => showPwdSet(s=>!s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878AA2] hover:text-[#8384A5]">
                        {showPwd ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  </button>
                </div>
                    {formErrors.password && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.password}</p>}
              </div>

                  {/* confirm */}
              <div>
                    <label className="block text-sm font-medium text-[#8384A5] mb-2">Confirm Password {editingId ? "" : "*"}</label>
                <div className="relative">
                  <input
                        type={showPwd2 ? "text" : "password"} name="confirmPassword"
                        value={form.confirmPassword} onChange={handleChange}
                        className="w-full px-3 py-2 pr-10 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9] focus:ring-2 focus:ring-[#886CFF]"
                        placeholder="Confirm password"/>
                      <button type="button" onClick={() => showPwd2Set(s=>!s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878AA2] hover:text-[#8384A5]">
                        {showPwd2 ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  </button>
                </div>
                    {formErrors.confirmPassword && <p className="text-[#E01B4F] text-sm mt-1">{formErrors.confirmPassword}</p>}
              </div>
              {form.role !== "User" && (
  <div>
    <label className="block text-sm font-medium text-[#8384A5] mb-2">
      Percentage %
    </label>
    <input
      name="percentage"
      value={form.percentage}
      onChange={handleChange}
      type="number" step="0.01" min="0" max="100"
      className="w-full px-3 py-2 border border-[#1E2D55] rounded-lg bg-[#0C0D1D] text-[#F9F9F9]
                 focus:ring-2 focus:ring-[#886CFF]"
      placeholder="e.g. 10"
    />
    {formErrors.percentage &&
      <p className="text-[#E01B4F] text-sm mt-1">{formErrors.percentage}</p>}
  </div>
)}

            </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={resetForm}
                    className="px-4 py-2 border border-[#1E2D55] text-[#8384A5] rounded-lg hover:bg-[#162140]">
                    Cancel
                  </button>
                  <button type="submit"
                    className="px-4 py-2 bg-[#886CFF] text-[#F9F9F9] rounded-lg hover:bg-[#9B82FF]">
                    {editingId ? "Update Client" : "Add Client"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {delDlg.open && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[10000]"
             onClick={() => setDelDlg({open:false,staffId:null,staffName:""})}>
          <div className="bg-[#0E1831] rounded-xl border border-[#1E2D55] w-full max-w-md"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#1E2D55]">
              <h3 className="text-lg font-medium text-[#F9F9F9] flex items-center">
                <Trash2 className="w-6 h-6 text-red-600 mr-2"/> Delete Client
                  </h3>
              <button onClick={() => setDelDlg({open:false,staffId:null,staffName:""})}
                      className="text-[#878AA2] hover:text-[#8384A5] p-1 rounded-full hover:bg-[#162140]">
                <X className="w-6 h-6"/>
              </button>
            </div>
            <div className="p-6 text-sm text-[#8384A5]">
              Are you sure you want to delete <strong>{delDlg.staffName}</strong>?  
              This action cannot be undone.
              </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#1E2D55] bg-[#0C0D1D]">
              <button onClick={() => setDelDlg({open:false,staffId:null,staffName:""})}
                      className="px-4 py-2 border border-[#1E2D55] text-[#8384A5] rounded-lg hover:bg-[#162140]">
                Cancel
              </button>
              <button onClick={confirmDelete}
                      className="px-4 py-2 bg-[#E01B4F] text-[#F9F9F9] rounded-lg hover:bg-[#C01545] flex items-center">
                <Trash2 className="w-4 h-4 mr-2"/> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={()=>setSnack(s=>({...s,open:false}))}>
        <Alert severity={snack.severity} onClose={()=>setSnack(s=>({...s,open:false}))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
