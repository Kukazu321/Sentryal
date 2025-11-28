import React, { useMemo, useState } from 'react';
import localFont from 'next/font/local';
import AuthSplitLayout from '../../components/layout/AuthSplitLayout';
import Select from '../../components/Select';

const neueLight = localFont({ src: '../../public/fonts/NeueHaasDisplayLight.ttf', display: 'swap' });
const neueRoman = localFont({ src: '../../public/fonts/NeueHaasDisplayRoman.ttf', display: 'swap' });

export default function Trial() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    companySize: '1-10',
    industry: 'Civil Engineering & Construction',
    project: '',
  });

  const jobTitles = useMemo(
    () => [
      { value: 'Ceo', label: 'Ceo' },
      { value: 'Commercial director', label: 'Commercial director' },
      { value: 'Cto', label: 'Cto' },
    ],
    []
  );
  const sizes = useMemo(
    () => [
      { value: '1-10', label: '1 - 10' },
      { value: '11-50', label: '11 - 50' },
      { value: '51-200', label: '51 - 200' },
      { value: '201-500', label: '201 - 500' },
      { value: '501-1000', label: '501 - 1000' },
      { value: '1001+', label: '+1001' },
    ],
    []
  );
  const industries = useMemo(
    () => [
      { value: 'Civil Engineering & Construction', label: 'Civil Engineering & Construction' },
      { value: 'Energy & Utilities', label: 'Energy & Utilities' },
      { value: 'Transportation', label: 'Transportation' },
      { value: 'Mining & Extraction', label: 'Mining & Extraction' },
      { value: 'Environmental & Urban Planning', label: 'Environmental & Urban Planning' },
      { value: 'Government & Public Sector', label: 'Government & Public Sector' },
    ],
    []
  );

  const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSelectChange = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: brancher à une API ou un service (analytics / CRM)
    // eslint-disable-next-line no-alert
    alert('Trial request submitted');
  };

  return (
    <AuthSplitLayout imageUrl="/media/formtrial.jpg" imageDarken={true}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #trial-form input::placeholder,
            #trial-form textarea::placeholder {
              color: #999;
              font-family: 'NeueHaasDisplayLight', sans-serif;
            }
          `,
        }}
      />
      <div className={neueRoman.className} id="trial-form">
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
          Book trial
        </h1>
        <p style={{ fontSize: '14px', color: '#555', marginBottom: '24px', lineHeight: 1.4 }}>
          A journey beyond the known stars, where memory and destiny collide, we help teams potential
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

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="corporateEmail" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Corporate email <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <input
              id="corporateEmail"
              type="email"
              required
              placeholder="Input your email"
              style={{
                width: '100%',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
              value={form.email}
              onChange={onChange('email')}
            />
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="jobTitle" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Job title / Role <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <Select
              id="jobTitle"
              value={form.title}
              onChange={onSelectChange('title')}
              options={jobTitles}
              placeholder="Input your job title / role"
            />
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="companySize" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Company size <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <Select id="companySize" value={form.companySize} onChange={onSelectChange('companySize')} options={sizes} />
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="industry" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Industry <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <Select id="industry" value={form.industry} onChange={onSelectChange('industry')} options={industries} />
          </div>

          <div style={{ maxWidth: '560px' }}>
            <label htmlFor="project" style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '6px' }}>
              Your project <span aria-hidden="true" style={{ color: '#333' }}>*</span>
            </label>
            <textarea
              id="project"
              placeholder="Describe your project in detail"
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
              className={neueLight.className}
              value={form.project}
              onChange={onChange('project')}
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
            Book Trial
          </button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}