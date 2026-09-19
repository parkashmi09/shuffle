import React, { useEffect, useState, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { API_BASE_URL, apiFetch, apiFetchPage, buildPath } from '../utils/api';
import { ENDPOINTS } from '../services/endpoints';

interface Blog {
  id: number;
  slug: string;
  title: string;
  subheading: string | null;
  description?: string;
  author: string;
  date: string | null;
  category: string;
  imageUrl: string | null;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const EMPTY_FORM = {
  title: '',
  subheading: '',
  description: '',
  author: '',
  category: '',
  date: '',
  isPublished: true,
  image: null as File | null,
};

const resolveImage = (img: string | null) => {
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  return img.startsWith('/') ? `${API_BASE_URL}${img}` : `${API_BASE_URL}/${img}`;
};

export default function BlogAdmin() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const { data } = await apiFetchPage<Blog>(ENDPOINTS.blogs.list, {
        query: { page: 1, limit: 100 },
      });
      setBlogs(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const openCreate = () => {
    setEditingBlog(null);
    setForm(EMPTY_FORM);
    setImagePreview(null);
    setShowForm(true);
  };

  const openEdit = async (blog: Blog) => {
    try {
      const full = await apiFetch<Blog>(buildPath(ENDPOINTS.blogs.get, { id: blog.id }));
      setEditingBlog(full);
      setForm({
        title: full.title,
        subheading: full.subheading || '',
        description: full.description || '',
        author: full.author || '',
        category: full.category || '',
        date: full.date ? String(full.date).slice(0, 10) : '',
        isPublished: full.published !== false,
        image: null,
      });
      setImagePreview(resolveImage(full.imageUrl));
      setShowForm(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load post');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBlog(null);
    setForm(EMPTY_FORM);
    setImagePreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm((f) => ({ ...f, image: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('subheading', form.subheading);
      fd.append('description', form.description);
      fd.append('author', form.author || 'Anonymous');
      fd.append('category', form.category || 'Uncategorized');
      fd.append('isPublished', form.isPublished ? 'true' : 'false');
      if (form.date) fd.append('date', new Date(form.date).toISOString());
      if (form.image) fd.append('image', form.image);

      if (editingBlog) {
        await apiFetch(buildPath(ENDPOINTS.blogs.update, { id: editingBlog.id }), {
          method: 'PATCH',
          body: fd,
        });
        toast.success('Blog updated');
      } else {
        await apiFetch(ENDPOINTS.blogs.create, { method: 'POST', body: fd });
        toast.success('Blog created');
      }

      closeForm();
      fetchBlogs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save blog');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (blog: Blog) => {
    if (!window.confirm(`Delete "${blog.title}"? This cannot be undone.`)) return;
    setDeletingId(blog.id);
    try {
      await apiFetch(buildPath(ENDPOINTS.blogs.remove, { id: blog.id }), { method: 'DELETE' });
      toast.success('Blog deleted');
      setBlogs((prev) => prev.filter((b) => b.id !== blog.id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete blog');
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
          <h1 className="text-2xl font-bold text-[#F9F9F9]">Blog Management</h1>
          <p className="text-[#878AA2] text-sm mt-1">
            {blogs.length} post{blogs.length !== 1 ? 's' : ''} — published posts appear on the player site at{' '}
            <code className="text-[#886CFF]">/blog</code>
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + New Post
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[#878AA2]">Loading...</div>
      ) : blogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-[#878AA2] gap-2">
          <p>No blog posts yet.</p>
          <button onClick={openCreate} className="text-[#886CFF] underline text-sm">Create your first post</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {blogs.map((blog) => (
            <div key={blog.id} className="bg-[#0E1831] border border-[#1E2D55] rounded-xl overflow-hidden flex flex-col">
              {blog.imageUrl && (
                <img
                  src={resolveImage(blog.imageUrl)}
                  alt={blog.title}
                  className="w-full h-40 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {blog.category && (
                    <span className="text-xs bg-[#886CFF]/20 text-[#886CFF] px-2 py-0.5 rounded font-medium">
                      {blog.category}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      blog.published ? 'bg-[#0ECC68]/20 text-[#0ECC68]' : 'bg-[#FFC23F]/20 text-[#FFC23F]'
                    }`}
                  >
                    {blog.published ? 'Published' : 'Draft'}
                  </span>
                  <span className="text-xs text-[#878AA2] ml-auto">
                    {blog.date ? new Date(blog.date).toLocaleDateString() : ''}
                  </span>
                </div>
                <h3 className="font-semibold text-[#F9F9F9] text-base leading-tight mb-1 line-clamp-2">{blog.title}</h3>
                {blog.subheading && <p className="text-[#878AA2] text-xs mb-2 line-clamp-1">{blog.subheading}</p>}
                <p className="text-[#878AA2] text-xs flex-1 line-clamp-3">{stripHtml(blog.subheading || '')}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1E2D55]">
                  <span className="text-xs text-[#878AA2]">{blog.author}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(blog)}
                      className="text-xs bg-[#1E2D55] hover:bg-[#1E2D55] text-[#F9F9F9] px-3 py-1.5 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(blog)}
                      disabled={deletingId === blog.id}
                      className="text-xs bg-[#E01B4F]/20 hover:bg-[#E01B4F]/40 text-[#E01B4F] px-3 py-1.5 rounded transition disabled:opacity-50"
                    >
                      {deletingId === blog.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#0E1831] border border-[#1E2D55] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#1E2D55]">
              <h2 className="text-lg font-semibold text-[#F9F9F9]">{editingBlog ? 'Edit Post' : 'New Blog Post'}</h2>
              <button onClick={closeForm} className="text-[#878AA2] hover:text-[#F9F9F9] text-xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm text-[#8384A5] mb-1">Title <span className="text-[#E01B4F]">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-[#8384A5] mb-1">Subheading</label>
                <input
                  type="text"
                  value={form.subheading}
                  onChange={(e) => setForm((f) => ({ ...f, subheading: e.target.value }))}
                  className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#8384A5] mb-1">Author</label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#8384A5] mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Casino, Sports, Crypto…"
                    className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#8384A5] mb-1">Display date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[#F9F9F9] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                  className="rounded border-[#1E2D55]"
                />
                Publish on the player site (drafts are only visible here in admin)
              </label>

              <div>
                <label className="block text-sm text-[#8384A5] mb-1">Body <span className="text-[#E01B4F]">*</span></label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Use HTML: <p>, <h2>, <h3>, <ul>, <table>. The player site applies Shuffle typography automatically."
                  rows={8}
                  className="w-full bg-[#0C0D1D] border border-[#1E2D55] rounded-lg px-3 py-2 text-[#F9F9F9] text-sm focus:outline-none focus:border-[#886CFF] resize-y font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-[#8384A5] mb-1">Cover image</label>
                {imagePreview && <img src={imagePreview} alt="preview" className="w-full h-48 object-cover rounded-lg mb-2" />}
                <input type="file" accept=".png,.jpg,.jpeg,.webp" ref={fileRef} onChange={handleFileChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-[#1E2D55] hover:border-[#886CFF] rounded-lg px-4 py-3 text-sm text-[#878AA2] hover:text-[#F9F9F9] transition text-center"
                >
                  {form.image ? form.image.name : 'Upload image (.png, .jpg, .webp)'}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-[#878AA2] border border-[#1E2D55] rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm bg-[#886CFF] hover:bg-[#9B82FF] text-[#F9F9F9] rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingBlog ? 'Update Post' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
