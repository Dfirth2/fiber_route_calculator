"""
PDF overlay service - adds drawn routes, markers, and conduits to PDF.
"""
import io
import math
from typing import List, Dict
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter


def _get_label(index: int) -> str:
    """Generate alphabetic label (A, B, C, ..., Z, AA, AB, ...)"""
    if index < 26:
        return chr(65 + index)  # A-Z
    else:
        # AA, AB, AC, etc.
        first = chr(65 + (index // 26) - 1)
        second = chr(65 + (index % 26))
        return first + second


def overlay_drawings_on_pdf(
    original_pdf_path: str,
    all_data: Dict = None,
    single_page: int = None,
    page_width: float = None,
    page_height: float = None,
    # Legacy parameters for backward compatibility
    polylines: List[Dict] = None,
    markers: List[Dict] = None,
    marker_links: List[Dict] = None,
    conduits: List[Dict] = None,
    page_number: int = None,
) -> bytes:
    """
    Overlay drawn routes, markers, and conduits on PDF pages.
    Returns the original PDF with route overlays on all pages.

    Args:
        original_pdf_path: Path to the original PDF file
        all_data: Dict containing polylines, markers, marker_links, conduits for all pages
        single_page: If provided, only overlay this specific page (1-indexed)
        page_width: Rendered page width from frontend
        page_height: Rendered page height from frontend

    Returns:
        Bytes of the PDF with route overlays
    """
    try:
        # Open and read original PDF
        with open(original_pdf_path, 'rb') as pdf_file:
            pdf_reader = PdfReader(pdf_file)
            pdf_writer = PdfWriter()
            
            # Handle legacy API
            if all_data is None and polylines is not None:
                all_data = {
                    "polylines": polylines or [],
                    "markers": markers or [],
                    "marker_links": marker_links or [],
                    "conduits": conduits or [],
                }
                single_page = page_number or 1
            
            # Process all pages
            for i in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[i]
                current_page_num = i + 1
                
                # Get rotation if any
                rotation = page.get('/Rotate', 0)
                print(f"PDF Overlay: Page {current_page_num} mediabox: {page.mediabox.width} x {page.mediabox.height}, rotation: {rotation}")
                
                # Determine if we should add overlay to this page
                should_overlay = (single_page is None) or (current_page_num == single_page)
                
                # Filter data for current page
                if should_overlay and all_data:
                    page_polylines = [p for p in all_data.get("polylines", []) if p.get("page_number") == current_page_num]
                    page_markers = [m for m in all_data.get("markers", []) if m.get("page_number") == current_page_num]
                    page_links = [l for l in all_data.get("marker_links", []) if l.get("page_number") == current_page_num]
                    page_conduits = [c for c in all_data.get("conduits", []) if c.get("page_number") == current_page_num]
                    
                    has_content = page_polylines or page_markers or page_conduits
                    
                    if has_content:
                        try:
                            # Use frontend dimensions if provided, otherwise use PDF mediabox
                            overlay_width = page_width if page_width else float(page.mediabox.width)
                            overlay_height = page_height if page_height else float(page.mediabox.height)
                            
                            print(f"PDF Overlay: Page {current_page_num} - Adding {len(page_polylines)} polylines, {len(page_markers)} markers, {len(page_conduits)} conduits")
                            print(f"PDF Overlay: Using dimensions {overlay_width} x {overlay_height}")
                            
                            # Create overlay with routes, markers, and conduits for this page
                            overlay_bytes = _create_overlay_content(
                                overlay_width,
                                overlay_height,
                                page_polylines,
                                page_markers,
                                page_links,
                                page_conduits,
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
                            print(f"Warning: Could not overlay content on page {current_page_num}: {e}")
                
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


def _get_label(index: int) -> str:
    """Generate alphabetic label (A, B, C, ..., Z, AA, AB, ...)"""
    if index < 26:
        return chr(65 + index)  # A-Z
    else:
        # AA, AB, AC, etc.
        first = chr(65 + (index // 26) - 1)
        second = chr(65 + (index % 26))
        return first + second


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
        
        # DRAWING ORDER: Back to front
        # 1. Draw handholes first (bottom layer - everything appears on top)
        if markers:
            handholes = [m for m in markers if m.get("type") == "handhole"]
            for marker in handholes:
                x, y = transform_point(marker.get("x", 0), marker.get("y", 0))
                size = 14
                # Outer purple square
                c.setFillColor("#a855f7", 1)  # Purple
                c.rect(x - size, y - size, size * 2, size * 2, fill=1, stroke=0)
                # White border
                c.setStrokeColor("#ffffff", 1)
                c.setLineWidth(2)
                c.rect(x - size, y - size, size * 2, size * 2, fill=0, stroke=1)
                # Hollow center (white square inside)
                inner_size = 6
                c.setFillColor("#ffffff", 1)
                c.rect(x - inner_size, y - inner_size, inner_size * 2, inner_size * 2, fill=1, stroke=0)
        
        # 2. Draw polylines (fiber routes and conduit polylines)
        if polylines:
            for idx, polyline in enumerate(polylines):
                points = polyline.get("points", [])
                polyline_type = polyline.get("type", "fiber")
                
                # Set color and width based on type
                if polyline_type == "conduit":
                    c.setStrokeColor("#9333ea", 1)  # Purple for conduits
                    c.setLineWidth(2)
                else:
                    c.setStrokeColor("#22c55e", 1)  # Green for fiber cables
                    c.setLineWidth(4)  # Thicker for better visibility
                
                if len(points) >= 2:
                    for i in range(len(points) - 1):
                        p1 = points[i]
                        p2 = points[i + 1]
                        
                        x1, y1 = transform_point(p1.get("x", 0), p1.get("y", 0))
                        x2, y2 = transform_point(p2.get("x", 0), p2.get("y", 0))
                        
                        c.line(x1, y1, x2, y2)
                
                # Add labels for fiber routes (not conduits) at 25% and 75% points
                if polyline_type != "conduit" and len(points) >= 2:
                    # Count which fiber route this is (skip conduits in numbering)
                    fiber_count = sum(1 for p in polylines[:idx+1] if p.get("type", "fiber") != "conduit")
                    
                    # Calculate total route length and segment lengths
                    segment_lengths = []
                    total_length = 0
                    for i in range(len(points) - 1):
                        dx = points[i + 1].get("x", 0) - points[i].get("x", 0)
                        dy = points[i + 1].get("y", 0) - points[i].get("y", 0)
                        seg_length = (dx * dx + dy * dy) ** 0.5
                        segment_lengths.append(seg_length)
                        total_length += seg_length
                    
                    # For short routes (< 100 pixels), use single label at midpoint
                    # For longer routes, use labels at 25% and 75%
                    positions = [0.5] if total_length < 100 else [0.25, 0.75]
                    
                    for position in positions:
                        target_dist = total_length * position
                        
                        # Find which segment contains this distance
                        accumulated_dist = 0
                        segment_idx = 0
                        local_t = 0
                        
                        for i in range(len(segment_lengths)):
                            if accumulated_dist + segment_lengths[i] >= target_dist:
                                segment_idx = i
                                local_t = (target_dist - accumulated_dist) / segment_lengths[i] if segment_lengths[i] > 0 else 0
                                break
                            accumulated_dist += segment_lengths[i]
                        
                        # Interpolate position along the segment
                        point = points[segment_idx]
                        next_point = points[segment_idx + 1]
                        x = point.get("x", 0) + (next_point.get("x", 0) - point.get("x", 0)) * local_t
                        y = point.get("y", 0) + (next_point.get("y", 0) - point.get("y", 0)) * local_t
                        label_x, label_y = transform_point(x, y)
                        
                        # Draw label background circle
                        c.setFillColor("#22c55e", 1)  # Green
                        c.setStrokeColor("#ffffff", 1)
                        c.setLineWidth(2)
                        c.circle(label_x, label_y, 12, fill=1, stroke=1)
                        
                        # Draw label number
                        c.setFillColor("#ffffff", 1)
                        c.setFont("Helvetica-Bold", 11)
                        c.drawCentredString(label_x, label_y - 2, str(fiber_count))
        
        # 3. Draw conduits (drop conduit connections)
        if conduits and markers:
            for conduit in conduits:
                term_marker = next((m for m in markers if m.get("id") == conduit.get("terminalId")), None)
                drop_marker = next((m for m in markers if m.get("id") == conduit.get("dropPedId")), None)
                
                if term_marker and drop_marker:
                    from_x, from_y = transform_point(term_marker.get("x", 0), term_marker.get("y", 0))
                    to_x, to_y = transform_point(drop_marker.get("x", 0), drop_marker.get("y", 0))
                    
                    # Draw solid conduit line in purple
                    c.setStrokeColor("#9333ea", 1)  # Purple
                    c.setLineWidth(3)
                    c.line(from_x, from_y, to_x, to_y)
        # 4. Draw marker assignment arrows
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
        
        # 5. Draw terminals and drops LAST (on top of everything) with labels
        if markers:
            # Separate markers by type for proper indexing
            terminals = [m for m in markers if m.get("type") == "terminal"]
            drops = [m for m in markers if m.get("type") == "dropPed"]
            
            # Draw terminals with labels inside
            for idx, marker in enumerate(terminals):
                x, y = transform_point(marker.get("x", 0), marker.get("y", 0))
                # Larger green triangle to fit letter inside (25% bigger: 24 * 1.25 = 30)
                size = 30
                h = size * math.sqrt(3) / 2
                c.setFillColor("#10b981", 1)  # Green
                c.setStrokeColor("#ffffff", 1)
                c.setLineWidth(2)
                path = c.beginPath()
                path.moveTo(x, y + h / 2)
                path.lineTo(x - size / 2, y - h / 2)
                path.lineTo(x + size / 2, y - h / 2)
                path.close()
                c.drawPath(path, fill=1, stroke=1)
                
                # Draw white label inside the triangle
                label = _get_label(idx)
                c.setFillColor("#ffffff", 1)
                c.setFont("Helvetica-Bold", 13)
                c.drawCentredString(x, y - 4, label)
            
            # Draw drops with labels
            for idx, marker in enumerate(drops):
                x, y = transform_point(marker.get("x", 0), marker.get("y", 0))
                # Purple circle
                radius = 12
                c.setFillColor("#a855f7", 1)  # Purple
                c.setStrokeColor("#ffffff", 1)
                c.setLineWidth(2)
                c.circle(x, y, radius, fill=1, stroke=1)
                
                # Draw white label inside the circle
                label = _get_label(idx)
                c.setFillColor("#ffffff", 1)
                c.setFont("Helvetica-Bold", 10)
                c.drawCentredString(x, y - 3, label)
        
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
