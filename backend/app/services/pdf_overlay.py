"""
PDF overlay service - adds drawn routes, markers, and conduits to PDF.
"""
import io
import math
from typing import List, Dict
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter


def overlay_drawings_on_pdf(
    original_pdf_path: str,
    polylines: List[Dict],
    markers: List[Dict],
    marker_links: List[Dict],
    conduits: List[Dict],
    page_number: int = 1,
    page_width: float = None,
    page_height: float = None,
) -> bytes:
    """
    Overlay drawn routes, markers, and conduits on a PDF page.
    Returns the original PDF with route overlays.

    Args:
        original_pdf_path: Path to the original PDF file
        polylines: List of polyline objects with points and metadata
        markers: List of marker objects (terminals, drop-peds)
        marker_links: List of marker assignment arrows
        conduits: List of conduit connections
        page_number: Which PDF page to overlay (1-indexed)

    Returns:
        Bytes of the PDF with route overlays
    """
    try:
        # Open and read original PDF
        with open(original_pdf_path, 'rb') as pdf_file:
            pdf_reader = PdfReader(pdf_file)
            pdf_writer = PdfWriter()
            
            # Validate page number
            if page_number < 1 or page_number > len(pdf_reader.pages):
                page_number = 1
            
            # Process all pages
            for i in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[i]
                
                # Get rotation if any
                rotation = page.get('/Rotate', 0)
                print(f"PDF Overlay: Page {i+1} mediabox: {page.mediabox.width} x {page.mediabox.height}, rotation: {rotation}")
                
                # Add overlay to target page only
                if i == page_number - 1 and (polylines or markers or conduits):
                    try:
                        # Get rotation
                        rotation = page.get('/Rotate', 0)
                        
                        # Use frontend dimensions if provided, otherwise use PDF mediabox
                        overlay_width = page_width if page_width else float(page.mediabox.width)
                        overlay_height = page_height if page_height else float(page.mediabox.height)
                        
                        print(f"PDF Overlay: Using dimensions {overlay_width} x {overlay_height} (frontend provided: {page_width is not None})")
                        
                        # Create overlay with routes, markers, and conduits
                        overlay_bytes = _create_overlay_content(
                            overlay_width,
                            overlay_height,
                            polylines,
                            markers,
                            marker_links,
                            conduits,
                            rotation=rotation,
                            original_width=float(page.mediabox.width),
                            original_height=float(page.mediabox.height),
                        )
                        
                        # Merge overlay with page
                        overlay_pdf = PdfReader(io.BytesIO(overlay_bytes))
                        overlay_page = overlay_pdf.pages[0]
                        page.merge_page(overlay_page)
                    except Exception as e:
                        # Log but don't fail - just include original page
                        print(f"Warning: Could not overlay content: {e}")
                
                pdf_writer.add_page(page)
            
            # Write result to bytes
            output = io.BytesIO()
            pdf_writer.write(output)
            output.seek(0)
            return output.getvalue()
    
    except Exception as e:
        # If any error, return original PDF
        print(f"Error in PDF overlay: {e}")
        with open(original_pdf_path, 'rb') as pdf_file:
            return pdf_file.read()


def _create_overlay_content(
    width: float,
    height: float,
    polylines: List[Dict],
    markers: List[Dict],
    marker_links: List[Dict],
    conduits: List[Dict],
    rotation: int = 0,
    original_width: float = None,
    original_height: float = None,
) -> bytes:
    """
    Create a PDF overlay with routes, markers, and conduits.
    
    Args:
        width: Rendered page width (after rotation)
        height: Rendered page height (after rotation)
        rotation: PDF rotation in degrees (0, 90, 180, 270)
        original_width: Original PDF page width (before rotation)
        original_height: Original PDF page height (before rotation)
    """
    pdf_buffer = io.BytesIO()
    
    # The canvas must be created with the ORIGINAL (unrotated) dimensions
    # because ReportLab will apply rotation when we merge
    if original_width and original_height and rotation in [90, 270]:
        # For 90/270 rotation, dimensions are swapped
        canvas_width = original_width
        canvas_height = original_height
    else:
        canvas_width = width
        canvas_height = height
    
    print(f"PDF Overlay: Creating overlay canvas {canvas_width} x {canvas_height} (rotation: {rotation})")
    if markers:
        print(f"PDF Overlay: First marker at ({markers[0].get('x')}, {markers[0].get('y')}) in rotated space")
    
    try:
        c = canvas.Canvas(pdf_buffer, pagesize=(canvas_width, canvas_height))
        c.setFillAlpha(1.0)
        
        # Helper function to transform coordinates based on rotation
        def transform_point(x, y):
            """Transform coordinates from rotated view to original PDF space."""
            if rotation == 0:
                # No rotation
                return x, canvas_height - y
            elif rotation == 90:
                # 90° clockwise: rotated (x,y) in WxH -> original at (y, W-x) in HxW
                return y, canvas_width - x
            elif rotation == 180:
                # 180°: rotated (x,y) in WxH -> original at (W-x, y) in WxH
                return canvas_width - x, y
            elif rotation == 270:
                # 270° clockwise (or 90° counter-clockwise)
                # Frontend rotated space: width x height (2592 x 1728), top-left origin
                # Original PDF space: height x width (1728 x 2592), bottom-left origin
                # 
                # Step 1: Rotate coordinates 270° clockwise (same as 90° counter-clockwise)
                #   In rotated frame (w,h), point at (x,y) from top-left
                #   Maps to original frame (h,w) at position (h-y, x) from top-left
                # Step 2: Convert to PDF bottom-left origin
                #   Y = original_height - Y_from_top = w - x
                new_x = height - y
                new_y = canvas_height - x  # canvas_height is original_height (2592)
                print(f"  270° transform: ({x}, {y}) -> ({new_x}, {new_y})")
                return new_x, new_y
            else:
                # Unsupported rotation, default to no rotation
                return x, canvas_height - y
        
        # Draw polylines (routes) in blue
        if polylines:
            c.setStrokeColor("#3b82f6", 1)  # Blue
            c.setLineWidth(2)
            
            for polyline in polylines:
                points = polyline.get("points", [])
                if len(points) >= 2:
                    for i in range(len(points) - 1):
                        p1 = points[i]
                        p2 = points[i + 1]
                        
                        x1, y1 = transform_point(p1.get("x", 0), p1.get("y", 0))
                        x2, y2 = transform_point(p2.get("x", 0), p2.get("y", 0))
                        
                        c.line(x1, y1, x2, y2)
        
        # Draw markers
        if markers:
            for marker in markers:
                x, y = transform_point(marker.get("x", 0), marker.get("y", 0))
                marker_type = marker.get("type", "terminal")
                
                if marker_type == "terminal":
                    # Green triangle
                    size = 15
                    h = size * math.sqrt(3) / 2
                    c.setFillColor("#10b981", 1)  # Green
                    c.setStrokeColor("#ffffff", 1)
                    c.setLineWidth(2)
                    path = c.beginPath()
                    path.moveTo(x, y - h)
                    path.lineTo(x - size / 2, y + h / 2)
                    path.lineTo(x + size / 2, y + h / 2)
                    path.close()
                    c.drawPath(path, fill=1, stroke=1)
                elif marker_type == "dropPed":
                    # Purple circle
                    radius = 12
                    c.setFillColor("#a855f7", 1)  # Purple
                    c.setStrokeColor("#ffffff", 1)
                    c.setLineWidth(2)
                    c.circle(x, y, radius, fill=1, stroke=1)
        
        # Draw marker assignment arrows
        if marker_links and markers:
            for link in marker_links:
                marker = next((m for m in markers if m.get("id") == link.get("markerId")), None)
                if marker:
                    from_x, from_y = transform_point(marker.get("x", 0), marker.get("y", 0))
                    to_x, to_y = transform_point(link.get("to", {}).get("x", 0), link.get("to", {}).get("y", 0))
                    
                    # Draw arrow line
                    c.setStrokeColor("#0f172a", 1)  # Dark
                    c.setLineWidth(2)
                    c.line(from_x, from_y, to_x, to_y)
                    
                    # Draw arrowhead
                    dx = to_x - from_x
                    dy = to_y - from_y
                    angle = math.atan2(dy, dx)
                    headlen = 12
                    
                    c.setFillColor("#0f172a", 1)
                    path = c.beginPath()
                    path.moveTo(to_x, to_y)
                    path.lineTo(
                        to_x - headlen * math.cos(angle - math.pi / 6),
                        to_y - headlen * math.sin(angle - math.pi / 6)
                    )
                    path.lineTo(
                        to_x - headlen * math.cos(angle + math.pi / 6),
                        to_y - headlen * math.sin(angle + math.pi / 6)
                    )
                    path.close()
                    c.drawPath(path, fill=1, stroke=0)
        
        # Draw conduits
        if conduits and markers:
            for conduit in conduits:
                term_marker = next((m for m in markers if m.get("id") == conduit.get("terminalId")), None)
                drop_marker = next((m for m in markers if m.get("id") == conduit.get("dropPedId")), None)
                
                if term_marker and drop_marker:
                    from_x, from_y = transform_point(term_marker.get("x", 0), term_marker.get("y", 0))
                    to_x, to_y = transform_point(drop_marker.get("x", 0), drop_marker.get("y", 0))
                    
                    # Draw dashed conduit line
                    c.setStrokeColor("#0ea5e9", 1)  # Sky blue
                    c.setLineWidth(3)
                    c.setDash([5, 5])
                    c.line(from_x, from_y, to_x, to_y)
                    c.setDash([])  # Reset dash
                    
                    # Add footage label at midpoint
                    mid_x = (from_x + to_x) / 2
                    mid_y = (from_y + to_y) / 2
                    footage_str = f"{conduit.get('footage', 0):.1f} ft"
                    
                    c.setFillColor("#0ea5e9", 1)
                    c.rect(mid_x - 30, mid_y - 6, 60, 12, fill=1, stroke=0)
                    
                    c.setFillColor("#ffffff", 1)
                    c.setFont("Helvetica-Bold", 10)
                    c.drawCentredString(mid_x, mid_y - 2, footage_str)
        
        c.save()
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()
    
    except Exception as e:
        print(f"Error creating overlay: {e}")
        # Return empty PDF if overlay creation fails
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=(612, 792))
        c.save()
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()
