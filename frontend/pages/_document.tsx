import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
    render() {
        return (
            <Html lang="en">
                <Head>
                    {/* Preload the local TrueType font to reduce FOUT */}
                    <link
                        rel="preload"
                        href="/fonts/NeueHaasDisplayRoman.ttf"
                        as="font"
                        type="font/ttf"
                        crossOrigin="anonymous"
                    />
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
