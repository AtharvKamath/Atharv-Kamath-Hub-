/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Mail,
  MapPin,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { InquiryCategory, Profile } from '../types';

interface ContactProps {
  profile: Profile;
  onContactClick?: (source: string) => void;
}

const CATEGORIES: InquiryCategory[] = [
  'General Inquiry',
  'Business Collaboration',
  'Project Discussion',
  'Technical Support',
  'Other',
];

export default function Contact({ profile, onContactClick }: ContactProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'General Inquiry' as InquiryCategory,
    message: '',
    website_url: '', // Spam honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'sent' | 'queued_retry' | 'failed' | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/system/status', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.emailConfigured === 'boolean') {
          setEmailConfigured(data.emailConfigured);
        } else {
          setEmailConfigured(false);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setEmailConfigured(false);
        }
      });
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeliveryNote(null);
    setDeliveryStatus(null);

    const name = form.name.trim();
    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (name.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (subject.length < 2) {
      setError('Please provide an inquiry subject.');
      return;
    }
    if (message.length < 5) {
      setError('Please write a message of at least 5 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject,
          category: form.category,
          message,
          website_url: form.website_url,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit your inquiry.');
      }

      const status: 'sent' | 'queued_retry' | 'failed' = data.notificationStatus || 'failed';
      setDeliveryStatus(status);
      setSuccessMsg(
        data.message ||
          (status === 'sent'
            ? 'Thank you for contacting Atharv Kamath Hub! Your inquiry has been sent to the owner.'
            : 'Your inquiry was saved in the database.')
      );
      if (status === 'queued_retry') {
        setDeliveryNote(
          data.notificationError
            ? `Email queued for automatic retry (${data.notificationError}).`
            : 'Your inquiry is securely saved in our database and email notification delivery has been queued for automatic retry.'
        );
      } else if (status === 'failed') {
        setDeliveryNote(
          data.notificationError ||
            'Your inquiry is saved in the Owner Dashboard, but email delivery failed because no email provider (SMTP / Resend) is configured yet.'
        );
      }

      setForm({
        name: '',
        email: '',
        subject: '',
        category: 'General Inquiry',
        message: '',
        website_url: '',
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to submit inquiry right now. Please try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-[#090d16] border-b border-white/5 relative">
      <div className="absolute bottom-0 left-0 w-full h-96 bg-gradient-to-t from-cyan-950/10 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-2">Get in Touch</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight font-sans">
            Business & Collaborations
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Details / Location Map Column */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Let's Create Together</h3>
              <p className="text-gray-400 text-sm font-light leading-relaxed">
                I am always open to creative ideas, sponsorships, tech reviews, travel collaborations, vlogging projects, or speaker opportunities. Feel free to shoot me a line!
              </p>
            </div>

            {/* Quick Location card */}
            <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                <MapPin size={20} />
              </div>
              <div>
                <h4 className="text-white font-sans font-semibold text-sm">Headquarters</h4>
                <p className="text-gray-400 text-xs mt-1 font-light leading-relaxed">{profile.location}</p>
              </div>
            </div>

            {/* Business Email card */}
            <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Mail size={20} />
              </div>
              <div>
                <h4 className="text-white font-sans font-semibold text-sm">Collaborations / Business Email</h4>
                <a
                  id="contact-email-link"
                  href={`mailto:${profile.email}`}
                  onClick={() => onContactClick?.('contact_section_email')}
                  className="text-cyan-400 text-xs md:text-sm hover:underline font-mono mt-1 block"
                >
                  {profile.email}
                </a>
              </div>
            </div>

            {/* Simulated Dark Map Graphic */}
            <div className="relative h-44 rounded-2xl border border-white/10 overflow-hidden bg-[#0c1221] shadow-inner flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px]" />
              <div className="absolute w-20 h-20 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />

              <div className="relative text-center flex flex-col items-center">
                <div className="p-2.5 bg-cyan-400 text-black rounded-full shadow-lg relative">
                  <MapPin size={18} />
                  <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-45 -z-10" />
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider uppercase mt-3">
                  Udupi, Karnataka, India
                </span>
                <span className="text-gray-500 text-[9px] font-mono mt-0.5">
                  13.3409° N, 74.7421° E
                </span>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7">
            <div className="bg-[#0c1220]/90 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
              <h3 className="text-white font-sans font-bold text-lg mb-6 flex items-center gap-2">
                <Send size={16} className="text-cyan-400" />
                Direct Inquiry Message
              </h3>

              {successMsg ? (
                <div
                  id="contact-success-notice"
                  className={`p-8 border rounded-2xl flex flex-col items-center text-center animate-scale-up space-y-4 ${
                    deliveryStatus === 'sent'
                      ? 'border-green-500/20 bg-green-500/5'
                      : deliveryStatus === 'failed'
                      ? 'border-red-500/25 bg-red-500/5'
                      : 'border-amber-500/25 bg-amber-500/5'
                  }`}
                >
                  <div
                    className={`p-3 rounded-full border ${
                      deliveryStatus === 'sent'
                        ? 'bg-green-500/15 text-green-400 border-green-500/30'
                        : deliveryStatus === 'failed'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {deliveryStatus === 'sent' ? (
                      <CheckCircle size={32} />
                    ) : deliveryStatus === 'failed' ? (
                      <AlertCircle size={32} />
                    ) : (
                      <Clock size={32} />
                    )}
                  </div>
                  <h4 className="text-white font-bold font-sans text-base">
                    {deliveryStatus === 'sent'
                      ? 'Inquiry Sent Successfully'
                      : deliveryStatus === 'queued_retry'
                      ? 'Inquiry Saved — Email Queued'
                      : 'Inquiry Saved — Email Delivery Failed'}
                  </h4>
                  <p className="text-gray-300 text-xs md:text-sm max-w-md font-light leading-relaxed">
                    {successMsg}
                  </p>
                  {deliveryNote && (
                    <p
                      className={`text-[11px] font-mono px-3 py-2 rounded-xl max-w-md break-words border ${
                        deliveryStatus === 'failed'
                          ? 'text-red-300 bg-red-500/10 border-red-500/25'
                          : 'text-amber-300/90 bg-amber-500/10 border-amber-500/20'
                      }`}
                    >
                      {deliveryNote}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessMsg(null);
                      setDeliveryNote(null);
                      setDeliveryStatus(null);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl text-xs font-mono cursor-pointer"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form id="contact-form" onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs font-mono flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Honeypot anti-spam field */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="contact-website-url">Website</label>
                    <input
                      id="contact-website-url"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website_url}
                      onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                    />
                  </div>

                  {/* Row 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-gray-400 font-sans text-xs font-semibold uppercase mb-2">
                        Your Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="John Doe"
                        className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 font-sans text-xs font-semibold uppercase mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="johndoe@email.com"
                        className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Subject & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-gray-400 font-sans text-xs font-semibold uppercase mb-2">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-subject"
                        type="text"
                        required
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        placeholder="Sponsorship / Project Inquiry"
                        className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 font-sans text-xs font-semibold uppercase mb-2">
                        Inquiry Category
                      </label>
                      <select
                        id="contact-category"
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value as InquiryCategory })
                        }
                        className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white focus:outline-none focus:border-cyan-400 transition-all"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-gray-400 font-sans text-xs font-semibold uppercase mb-2">
                      Inquiry Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      required
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Write your creative collaboration proposal details here..."
                      className="w-full px-4 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs md:text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 transition-all resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    id="contact-submit"
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-sans font-bold text-xs md:text-sm uppercase tracking-wider rounded-xl hover:shadow-cyan-500/25 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Clock size={14} className="animate-spin" /> SENDING INQUIRY...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> SEND DIRECT INQUIRY
                      </>
                    )}
                  </button>

                  <p
                    id="contact-delivery-status"
                    role="status"
                    aria-live="polite"
                    className={`text-xs font-mono text-center flex items-center justify-center gap-1.5 pt-2 ${
                      emailConfigured === true
                        ? 'text-cyan-300'
                        : emailConfigured === false
                        ? 'text-amber-300'
                        : 'text-gray-400'
                    }`}
                  >
                    {emailConfigured === true ? (
                      <>
                        <Mail size={13} className="text-cyan-400 shrink-0" aria-hidden="true" />
                        <span>Email notifications are configured for the Owner contact.</span>
                      </>
                    ) : emailConfigured === false ? (
                      <>
                        <AlertCircle size={13} className="text-amber-400 shrink-0" aria-hidden="true" />
                        <span>
                          Inquiries are saved to the Owner Dashboard, but email notification is not configured.
                        </span>
                      </>
                    ) : (
                      <>
                        <Clock size={13} className="text-gray-400 shrink-0" aria-hidden="true" />
                        <span>Checking email notification status...</span>
                      </>
                    )}
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
