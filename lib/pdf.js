const PDFDocument = require('pdfkit');

async function generatePDF(data) {
  return new Promise(function(resolve, reject) {
    try {
      var doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
      var buffers = [];
      doc.on('data', function(chunk) { buffers.push(chunk); });
      doc.on('end', function() { resolve(Buffer.concat(buffers)); });
      doc.on('error', reject);

      var orgName = data.orgName || 'Agreement';
      var pageWidth = doc.page.width - 120;

      // Header bar
      doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');
      doc.fontSize(22).fillColor('#ffffff').text(orgName, 60, 28, { width: pageWidth });
      doc.fontSize(10).fillColor('#94a3b8').text('Service Agreement', 60, 54, { width: pageWidth });

      doc.y = 100;

      // Title
      doc.fillColor('#1e293b');
      doc.fontSize(16).text(data.title || 'Agreement', 60, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#64748b').text('Contract #' + data.contractNumber, 60, doc.y);

      // Details grid
      doc.moveDown(1.2);
      var detailY = doc.y;

      // Left column - Customer info
      doc.fontSize(9).fillColor('#94a3b8').text('CUSTOMER', 60, detailY);
      doc.fontSize(11).fillColor('#1e293b').text(data.customerName || 'N/A', 60, detailY + 14);
      var nextY = detailY + 28;
      if (data.signerTitle) {
        doc.fontSize(9).fillColor('#64748b').text(data.signerTitle, 60, nextY);
        nextY += 13;
      }
      if (data.signerCompany || data.customerCompany) {
        doc.fontSize(9).fillColor('#64748b').text(data.signerCompany || data.customerCompany, 60, nextY);
        nextY += 13;
      }
      if (data.signerEmail || data.customerEmail) {
        doc.fontSize(9).fillColor('#64748b').text(data.signerEmail || data.customerEmail, 60, nextY);
        nextY += 13;
      }
      if (data.signerPhone) {
        doc.fontSize(9).fillColor('#64748b').text(data.signerPhone, 60, nextY);
        nextY += 13;
      }
      if (data.signerAddress) {
        doc.fontSize(9).fillColor('#64748b').text(data.signerAddress, 60, nextY, { width: 220 });
        nextY += 13;
      }

      // Right column - Contract details
      doc.fontSize(9).fillColor('#94a3b8').text('START DATE', 340, detailY);
      var startStr = data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
      doc.fontSize(11).fillColor('#1e293b').text(startStr, 340, detailY + 14);

      doc.fontSize(9).fillColor('#94a3b8').text('END DATE', 340, detailY + 36);
      var endStr = data.endDate ? new Date(data.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Month-to-Month';
      doc.fontSize(11).fillColor('#1e293b').text(endStr, 340, detailY + 50);

      if (data.termMonths) {
        doc.fontSize(9).fillColor('#94a3b8').text('TERM', 340, detailY + 72);
        doc.fontSize(11).fillColor('#1e293b').text(data.termMonths + ' months', 340, detailY + 86);
      }

      // Line items table
      doc.y = Math.max(nextY, detailY + 100) + 10;
      doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);

      var tableY = doc.y;
      doc.rect(60, tableY, pageWidth, 24).fill('#f1f5f9');
      doc.fontSize(9).fillColor('#64748b');
      doc.text('Description', 68, tableY + 7, { width: 240 });
      doc.text('Qty', 316, tableY + 7, { width: 40, align: 'center' });
      doc.text('Price', 364, tableY + 7, { width: 70, align: 'right' });
      doc.text('Total', 442, tableY + 7, { width: 70, align: 'right' });

      doc.y = tableY + 28;

      if (data.items && data.items.length > 0) {
        data.items.forEach(function(item, idx) {
          if (doc.y > 680) { doc.addPage(); doc.y = 50; }
          var rowY = doc.y;
          if (idx % 2 === 1) doc.rect(60, rowY, pageWidth, 22).fill('#f8fafc');
          doc.fontSize(10).fillColor('#1e293b').text(item.description || '', 68, rowY + 6, { width: 240 });
          doc.fillColor('#64748b').text(String(parseFloat(item.quantity || 1)), 316, rowY + 6, { width: 40, align: 'center' });
          doc.text('$' + parseFloat(item.unit_price || 0).toFixed(2), 364, rowY + 6, { width: 70, align: 'right' });
          doc.fillColor('#1e293b').font('Helvetica-Bold').text('$' + parseFloat(item.total_price || 0).toFixed(2), 442, rowY + 6, { width: 70, align: 'right' });
          doc.font('Helvetica');
          doc.y = rowY + 24;
        });
      }

      // Total line
      doc.moveDown(0.3);
      doc.moveTo(360, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#1e293b').lineWidth(2).stroke();
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text('Total: $' + parseFloat(data.totalValue || 0).toFixed(2) + '/mo', 360, doc.y, { width: pageWidth - 300, align: 'right' });
      doc.font('Helvetica');

      // Legal terms
      if (data.legalTerms) {
        doc.moveDown(2);
        if (doc.y > 580) { doc.addPage(); doc.y = 50; }
        doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold').text('Terms & Conditions', 60, doc.y);
        doc.font('Helvetica');
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor('#64748b').text(data.legalTerms, 60, doc.y, { width: pageWidth, lineGap: 2 });
      }

      // Signatures section
      doc.moveDown(2);
      if (doc.y > 580) { doc.addPage(); doc.y = 50; }
      doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      doc.moveDown(1);
      doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold').text('Electronic Signatures', 60, doc.y);
      doc.font('Helvetica');
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#94a3b8').text('This agreement was electronically signed in accordance with the UETA and ESIGN Act.', 60, doc.y);
      doc.moveDown(1.2);

      var sigY = doc.y;

      // Provider signature (left)
      doc.rect(60, sigY, pageWidth / 2 - 10, 80).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(8).fillColor('#94a3b8').text('PROVIDER', 72, sigY + 8);
      doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold').text(data.adminSignatureName || 'N/A', 72, sigY + 22);
      doc.font('Helvetica');
      doc.fontSize(9).fillColor('#64748b').text(orgName, 72, sigY + 40);
      if (data.adminSignedAt) {
        doc.fontSize(8).fillColor('#94a3b8').text('Signed: ' + new Date(data.adminSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 72, sigY + 56);
      }

      // Customer signature (right)
      var rightX = 60 + pageWidth / 2 + 10;
      doc.rect(rightX, sigY, pageWidth / 2 - 10, 80).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      doc.fontSize(8).fillColor('#94a3b8').text('CUSTOMER', rightX + 12, sigY + 8);
      doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold').text(data.customerSignatureName || 'N/A', rightX + 12, sigY + 22);
      doc.font('Helvetica');
      var sigDetails = [];
      if (data.signerTitle) sigDetails.push(data.signerTitle);
      if (data.signerCompany || data.customerCompany) sigDetails.push(data.signerCompany || data.customerCompany);
      doc.fontSize(9).fillColor('#64748b').text(sigDetails.join(', ') || '', rightX + 12, sigY + 40, { width: pageWidth / 2 - 34 });
      if (data.customerSignedAt) {
        doc.fontSize(8).fillColor('#94a3b8').text('Signed: ' + new Date(data.customerSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), rightX + 12, sigY + 56);
      }

      // Footer
      doc.y = sigY + 100;
      doc.fontSize(7).fillColor('#94a3b8').text(
        'Generated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' | ' + orgName + ' | agreements.hawaiidata.ai',
        60, doc.y, { width: pageWidth, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePDF: generatePDF };
