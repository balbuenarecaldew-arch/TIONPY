import { storeConfig } from '../config/store';
import { DEFAULT_PAYMENT_SETTINGS, normalizePaymentSettings } from './storeSettings';

const SUMMARY_WIDTH = 1080;
const CARD_PADDING = 56;
const MAX_VISIBLE_ITEMS = 6;

export function formatGs(value) {
  return `Gs. ${Number(value || 0).toLocaleString('es-PY')}`;
}

export function getTransferSummaryLines(paymentSettings = DEFAULT_PAYMENT_SETTINGS) {
  const settings = normalizePaymentSettings(paymentSettings);
  const lines = [];

  if (settings.transfer.owner) lines.push(`Titular: ${settings.transfer.owner}`);
  if (settings.transfer.bank) lines.push(`Banco: ${settings.transfer.bank}`);
  if (settings.transfer.account) lines.push(`Cuenta / alias: ${settings.transfer.account}`);
  if (settings.transfer.instructions) lines.push(settings.transfer.instructions);

  return lines;
}

export function buildPaymentRequestMessage({
  order,
  paymentSettings = DEFAULT_PAYMENT_SETTINGS,
  storeName = storeConfig.name,
}) {
  const settings = normalizePaymentSettings(paymentSettings);
  const customerName = order?.address_snapshot?.full_name || order?.customer_name || 'cliente';
  const deliveryCode = order?.address_snapshot?.delivery_code;
  const lines = [
    `Hola ${customerName}, soy de ${storeName}.`,
    `Te comparto el resumen de tu pedido ${order?.order_number}.`,
    `Total del pedido: ${formatGs(order?.total)}.`,
    'Para confirmar y enviar tu pedido, por favor envianos el comprobante de pago por este medio.',
  ];

  if (deliveryCode) {
    lines.push(`Codigo de entrega: ${deliveryCode}.`);
  }

  const transferLines = getTransferSummaryLines(settings);
  if (transferLines.length) {
    lines.push('Datos para la transferencia:');
    lines.push(...transferLines);
  }

  if (settings.whatsapp.extraMessage) {
    lines.push(settings.whatsapp.extraMessage);
  }

  lines.push('Apenas recibamos el pago te confirmamos y seguimos con la preparacion del pedido.');

  return lines.filter(Boolean).join('\n');
}

function buildWhatsappLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildSummaryFilename(order) {
  const safeOrderNumber = String(order?.order_number || 'pedido')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return `resumen-${safeOrderNumber || 'pedido'}.png`;
}

function downloadBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, color) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, color) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function wrapText(ctx, text, maxWidth) {
  const value = String(text || '').trim();
  if (!value) return [];

  const words = value.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word);
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function truncateText(text, maxLength = 38) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('No se pudo generar la imagen del resumen'));
      }
    }, 'image/png');
  });
}

export async function generateOrderSummaryImageBlob({
  order,
  items = [],
  paymentSettings = DEFAULT_PAYMENT_SETTINGS,
  storeName = storeConfig.name,
}) {
  const settings = normalizePaymentSettings(paymentSettings);
  const visibleItems = (items || []).slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = Math.max(0, (items || []).length - visibleItems.length);
  const transferLines = getTransferSummaryLines(settings);
  const customerName = order?.address_snapshot?.full_name || order?.customer_name || 'Cliente';
  const customerCity = order?.address_snapshot?.city || storeConfig.city;
  const deliveryCode = order?.address_snapshot?.delivery_code || '--';
  const orderDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString('es-PY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('es-PY');

  const canvas = document.createElement('canvas');
  canvas.width = SUMMARY_WIDTH;

  let ctx = canvas.getContext('2d');
  ctx.font = '500 24px Arial';

  const wrappedTransferLines = transferLines.flatMap((line) => wrapText(ctx, line, SUMMARY_WIDTH - CARD_PADDING * 3));
  const footerLines = wrapText(
    ctx,
    'Envia tu comprobante por WhatsApp para confirmar y despachar el pedido.',
    SUMMARY_WIDTH - CARD_PADDING * 3
  );

  const headerHeight = 210;
  const itemsHeight = Math.max(visibleItems.length, 1) * 66 + (hiddenCount ? 40 : 0) + 80;
  const transferHeight = Math.max(wrappedTransferLines.length, 2) * 34 + 120;
  const footerHeight = footerLines.length * 32 + 80;
  const canvasHeight = headerHeight + itemsHeight + transferHeight + footerHeight + 180;

  canvas.height = canvasHeight;
  ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, '#eff6ff');
  gradient.addColorStop(1, '#f8fafc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SUMMARY_WIDTH, canvasHeight);

  fillRoundRect(ctx, CARD_PADDING, CARD_PADDING, SUMMARY_WIDTH - CARD_PADDING * 2, canvasHeight - CARD_PADDING * 2, 36, '#ffffff');
  strokeRoundRect(ctx, CARD_PADDING, CARD_PADDING, SUMMARY_WIDTH - CARD_PADDING * 2, canvasHeight - CARD_PADDING * 2, 36, '#dbeafe');

  fillRoundRect(ctx, CARD_PADDING + 28, CARD_PADDING + 28, SUMMARY_WIDTH - CARD_PADDING * 2 - 56, 162, 28, '#1d4ed8');

  ctx.fillStyle = '#bfdbfe';
  ctx.font = '600 24px Arial';
  ctx.fillText('Resumen de cobro', CARD_PADDING + 62, CARD_PADDING + 76);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 48px Arial';
  ctx.fillText(storeName, CARD_PADDING + 62, CARD_PADDING + 132);

  ctx.font = '500 24px Arial';
  ctx.fillText(`Pedido ${order?.order_number || 'TION'}`, CARD_PADDING + 62, CARD_PADDING + 170);

  fillRoundRect(ctx, SUMMARY_WIDTH - CARD_PADDING - 312, CARD_PADDING + 54, 250, 84, 24, '#eff6ff');
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '700 22px Arial';
  ctx.fillText('Total del pedido', SUMMARY_WIDTH - CARD_PADDING - 278, CARD_PADDING + 90);
  ctx.font = '700 34px Arial';
  ctx.fillText(formatGs(order?.total), SUMMARY_WIDTH - CARD_PADDING - 278, CARD_PADDING + 126);

  let cursorY = CARD_PADDING + 228;
  const sectionX = CARD_PADDING + 32;
  const sectionWidth = SUMMARY_WIDTH - CARD_PADDING * 2 - 64;

  fillRoundRect(ctx, sectionX, cursorY, sectionWidth, 118, 24, '#f8fafc');
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 24px Arial';
  ctx.fillText(customerName, sectionX + 28, cursorY + 44);
  ctx.font = '500 22px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(customerCity, sectionX + 28, cursorY + 80);
  ctx.fillText(`Fecha: ${orderDate}`, sectionX + 28, cursorY + 110);
  ctx.fillText(`Codigo de entrega: ${deliveryCode}`, sectionX + sectionWidth - 320, cursorY + 80);

  cursorY += 142;

  fillRoundRect(ctx, sectionX, cursorY, sectionWidth, itemsHeight, 24, '#ffffff');
  strokeRoundRect(ctx, sectionX, cursorY, sectionWidth, itemsHeight, 24, '#e2e8f0');
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 28px Arial';
  ctx.fillText('Resumen de productos', sectionX + 28, cursorY + 44);

  let itemY = cursorY + 92;
  if (visibleItems.length === 0) {
    ctx.font = '500 22px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText('No se encontraron productos para este resumen.', sectionX + 28, itemY);
    itemY += 52;
  } else {
    for (const item of visibleItems) {
      fillRoundRect(ctx, sectionX + 22, itemY - 34, sectionWidth - 44, 52, 18, '#f8fafc');

      ctx.fillStyle = '#1d4ed8';
      ctx.font = '700 24px Arial';
      ctx.fillText(`${Number(item.quantity || 0)}x`, sectionX + 42, itemY);

      ctx.fillStyle = '#0f172a';
      ctx.font = '600 22px Arial';
      ctx.fillText(
        truncateText(item?.product_snapshot?.name || item?.name || 'Producto'),
        sectionX + 120,
        itemY
      );

      ctx.fillStyle = '#334155';
      ctx.font = '700 22px Arial';
      ctx.fillText(
        formatGs(Number(item.unit_price || 0) * Number(item.quantity || 0)),
        sectionX + sectionWidth - 240,
        itemY
      );

      itemY += 66;
    }
  }

  if (hiddenCount > 0) {
    ctx.font = '500 21px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Y ${hiddenCount} producto(s) mas en el pedido.`, sectionX + 28, itemY);
    itemY += 40;
  }

  cursorY += itemsHeight + 28;

  fillRoundRect(ctx, sectionX, cursorY, sectionWidth, transferHeight, 24, '#ecfdf5');
  strokeRoundRect(ctx, sectionX, cursorY, sectionWidth, transferHeight, 24, '#bbf7d0');
  ctx.fillStyle = '#065f46';
  ctx.font = '700 28px Arial';
  ctx.fillText('Datos para la transferencia', sectionX + 28, cursorY + 44);

  let transferY = cursorY + 92;
  const linesToDraw = wrappedTransferLines.length
    ? wrappedTransferLines
    : ['Completa los datos de cobro en el panel admin para que se adjunten aqui.'];

  ctx.font = '500 22px Arial';
  ctx.fillStyle = '#064e3b';
  for (const line of linesToDraw) {
    ctx.fillText(line, sectionX + 28, transferY);
    transferY += 34;
  }

  cursorY += transferHeight + 28;

  fillRoundRect(ctx, sectionX, cursorY, sectionWidth, footerHeight, 24, '#eff6ff');
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '700 24px Arial';
  ctx.fillText('Siguiente paso', sectionX + 28, cursorY + 42);

  ctx.font = '500 22px Arial';
  let footerY = cursorY + 82;
  for (const line of footerLines) {
    ctx.fillText(line, sectionX + 28, footerY);
    footerY += 32;
  }

  return toBlob(canvas);
}

export async function shareOrderPaymentRequest({
  order,
  items = [],
  phone,
  paymentSettings = DEFAULT_PAYMENT_SETTINGS,
  storeName = storeConfig.name,
  popupWindow = null,
}) {
  const message = buildPaymentRequestMessage({ order, paymentSettings, storeName });
  const whatsappUrl = buildWhatsappLink(phone, message);
  const summaryBlob = await generateOrderSummaryImageBlob({ order, items, paymentSettings, storeName });
  const filename = buildSummaryFilename(order);
  const summaryFile = typeof File !== 'undefined'
    ? new File([summaryBlob], filename, { type: 'image/png' })
    : null;

  let canShareFile = false;

  try {
    canShareFile = Boolean(
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      summaryFile &&
      navigator.canShare({ files: [summaryFile] })
    );
  } catch (error) {
    canShareFile = false;
  }

  if (canShareFile) {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }

    await navigator.share({
      title: `Resumen ${order?.order_number || ''}`.trim(),
      text: message,
      files: [summaryFile],
    });

    return {
      method: 'share',
      message,
      hasImage: true,
    };
  }

  downloadBlob(summaryBlob, filename);

  if (popupWindow && !popupWindow.closed) {
    popupWindow.location.replace(whatsappUrl);
  } else {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    method: 'fallback',
    message,
    hasImage: true,
  };
}
