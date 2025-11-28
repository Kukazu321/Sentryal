import React from 'react';

type AuthSplitLayoutProps = {
  children: React.ReactNode;
  imageUrl?: string;
  leftBg?: string;
  imageDarken?: boolean;
};

export default function AuthSplitLayout({ children, imageUrl = '/media/formimage.jpg', leftBg = '#f8f9fa', imageDarken = false }: AuthSplitLayoutProps) {
  return (
    <div
      className="auth-split-layout"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'white',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: '1200px',
          backgroundColor: 'white',
          overflow: 'hidden',
          borderRadius: '10px',
        }}
      >
        <div
          style={{
            flex: 1,
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: leftBg,
          }}
        >
          {children}
        </div>
        <div
          style={{
            flex: 1,
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '500px',
            position: 'relative',
          }}
        >
          {imageDarken && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}


