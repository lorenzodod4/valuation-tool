import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AUTHOR } from "@/lib/author";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-grid">
          <div>
            <Link href="/" className="brand" aria-label="Valuation.io home">
              <BrandMark size={20} />
              <span>
                Valuation<span className="brand-suffix">.io</span>
              </span>
            </Link>
            <p style={{ marginTop: 12, maxWidth: "40ch" }}>
              First-pass equity valuation with every assumption on the page.
            </p>
          </div>
          <div>
            <h2>Product</h2>
            <ul>
              <li><Link href="/#analyze">Analyze a ticker</Link></li>
              <li><Link href="/methodology">Methodology</Link></li>
              <li><Link href="/about">About</Link></li>
            </ul>
          </div>
          <div>
            <h2>Data</h2>
            <ul>
              <li>Financial Modeling Prep</li>
              <li>Damodaran (Rf, ERP)</li>
              <li>Prices may be delayed</li>
            </ul>
          </div>
        </div>
        <div className="site-footer-legal">
          <span>Educational use only. Not investment advice.</span>
          <span>
            © {new Date().getFullYear()} {AUTHOR.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
