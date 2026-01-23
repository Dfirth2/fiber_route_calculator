import os
from typing import Tuple
try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

def get_pdf_page_count(pdf_path: str) -> int:
    """Get total page count from PDF file."""
    if not PyPDF2:
        raise ImportError("PyPDF2 is required for PDF handling")
    
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        return len(reader.pages)

def validate_pdf_file(file_path: str) -> Tuple[bool, str]:
    """
    Validate that the file is a valid PDF.
    
    Returns:
        (is_valid, message)
    """
    if not os.path.exists(file_path):
        return False, "File does not exist"
    
    if not file_path.lower().endswith('.pdf'):
        return False, "File is not a PDF"
    
    if not PyPDF2:
        return True, "PyPDF2 not available - skipping PDF validation"
    
    try:
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            if not reader.pages:
                return False, "PDF has no pages"
        return True, "Valid PDF"
    except Exception as e:
        return False, f"Invalid PDF: {str(e)}"

def get_pdf_info(pdf_path: str) -> dict:
    """Get detailed information about a PDF file."""
    if not PyPDF2:
        raise ImportError("PyPDF2 is required for PDF handling")
    
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            
            page_count = len(reader.pages)
            page_sizes = []
            
            for page in reader.pages:
                # Get page dimensions
                if "/MediaBox" in page:
                    media_box = page["/MediaBox"]
                    width = float(media_box[2]) - float(media_box[0])
                    height = float(media_box[3]) - float(media_box[1])
                    page_sizes.append({"width": width, "height": height})
            
            return {
                "page_count": page_count,
                "page_sizes": page_sizes,
                "is_valid": True,
            }
    except Exception as e:
        return {
            "page_count": 0,
            "page_sizes": [],
            "is_valid": False,
            "error": str(e),
        }
