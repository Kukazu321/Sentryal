import React, { useMemo, useState } from 'react';
import localFont from 'next/font/local';
import AuthSplitLayout from '../components/layout/AuthSplitLayout';
import Select from '../components/Select';

const neueLight = localFont({ src: '../public/fonts/NeueHaasDisplayLight.ttf', display: 'swap' });
const neueRoman = localFont({ src: '../public/fonts/NeueHaasDisplayRoman.ttf', display: 'swap' });

export default function Contact() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    corporateEmail: '',
    companyName: '',
    contactType: '',
    message: '',
  });

  const contactTypes = useMemo(
    () => [
      { value: 'Sales', label: 'Sales' },
      { value: 'Support', label: 'Support' },
      { value: 'Partnership', label: 'Partnership' },
      { value: 'Other', label: 'Other' },
    ],
    []
  );

  const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSelectChange = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: brancher à une API ou un service
    // eslint-disable-next-line no-alert
    alert('Contact form submitted');
  };

  return (
    <AuthSplitLayout imageUrl="/media/contactform.jpg" imageDarken={true}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #contact-form input::placeholder,
            #contact-form textarea::placeholder {
              color: #999;
              font-family: 'NeueHaasDisplayLight', sans-serif;
            }
          `,
        }}
      />
      <div className={neueRoman.className} id="contact-form">
        <h1
          className={neueLight.className}
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#111',
            marginBottom: '8px',
            textAlign: 'left',
          }}
        >
          Get in Touch
        </h1>
        <p style={{ fontSize: '14px', color: '#555', marginBottom: '32px', lineHeight: 1.4, textAlign: 'left' }}>
          For strategic questions, partnership opportunities, or additional details before moving forward.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', maxWidth: '560px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="firstName" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                First name <span aria-hidden="true" style={{ color: '#333' }}>*</span>
              </label>
              <input
                id="firstName"
                type="text"
                required
                placeholder="Input your first name"
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
                value={form.firstName}
                onChange={onChange('firstName')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lastName" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                Last name <span aria-hidden="true" style={{ color: '#333' }}>*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                placeholder="Input your last name"
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
                value={form.lastName}
                onChange={onChange('lastName')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', maxWidth: '560px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="companyName" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                Company Name <span aria-hidden="true" style={{ color: '#333' }}>*</span>
              </label>
              <input
                id="companyName"
                type="text"
                required
                placeholder="Input your company name"
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
                value={form.companyName}
                onChange={onChange('companyName')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="contactType" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                Who would you like to contact? <span aria-hidden="true" style={{ color: '#333' }}>*</span>
              </label>
              <Select
                id="contactType"
                value={form.contactType}
                onChange={onSelectChange('contactType')}
                options={contactTypes}
                placeholder="Choose from the list"
              />
            </div>
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="corporateEmail" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Corporate email <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <input
              id="corporateEmail"
              type="email"
              required
              placeholder="Input your corporate email"
              style={{
                width: '100%',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
              value={form.corporateEmail}
              onChange={onChange('corporateEmail')}
            />
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="message" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Message <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <textarea
              id="message"
              placeholder="Tell us how we can help you..."
              rows={8}
              style={{
                width: '100%',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '16px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              value={form.message}
              onChange={onChange('message')}
            />
          </div>

          <button
            type="submit"
            className={neueLight.className}
            style={{
              backgroundColor: '#000',
              color: 'white',
              padding: '16px 14px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              maxWidth: '560px',
            }}
          >
            Contact Us
          </button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}

