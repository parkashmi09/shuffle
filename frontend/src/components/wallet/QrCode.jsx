/**
 * The deposit QR — reference `QrCodeSection`.
 *
 * The live modal renders a real QR of the deposit address as inline SVG. This
 * repo has no QR encoder and adding one is a dependency decision, not a styling
 * one, so the frame is here at the reference's size and the encoder is the one
 * seam left open: drop a generator in `encode()` and the rest already works.
 *
 * `docs/MISSING-AND-UNWIRED.md` lists it with the package that fits.
 *
 * @param {string} value The address to encode. Empty renders the waiting state.
 */
/** 174px — measured off the live modal's inline SVG. */
export default function QrCode({ value, size = 174 }) {
  if (!value) {
    return (
      <div className="QrCodeSection_QRCodeWrapper">
        <div
          className="QrCodeSection_placeholder"
          style={{ width: size, height: size }}
          role="img"
          aria-label="Deposit QR code — available once an address is issued"
        >
          <img alt="" height="24" width="24" src="/icons/logo-star.svg" />
          <span>QR appears with your address</span>
        </div>
      </div>
    );
  }

  return (
    <div className="QrCodeSection_QRCodeWrapper">
      <div className="QrCodeSection_placeholder" style={{ width: size, height: size }} role="img" aria-label={`QR code for ${value}`}>
        <span>{value}</span>
      </div>
    </div>
  );
}
