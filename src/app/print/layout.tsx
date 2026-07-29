export const metadata = { title: 'Print' };

/**
 * Bare shell for the routes headless Chrome screenshots. No nav, no margins,
 * white paper — whatever is on this page IS the print file.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { margin: 0; padding: 0; background: #fff; }
            @page { size: 8.5in 11in; margin: 0; }
            .sheet { break-after: page; page-break-after: always; }
            .sheet:last-child { break-after: auto; page-break-after: auto; }
          `,
        }}
      />
      {children}
    </>
  );
}
