"""Cable configuration service with calculation logic."""
from math import ceil
from typing import List, Dict


# Valid cable sizes and type compatibility
CABLE_SIZES_BOTH = {24, 48, 72, 144, 288, 432}  # Can be BAU or FNAP
CABLE_SIZES_BAU_ONLY = {216, 864}  # BAU only
CABLE_SIZES_ALL = CABLE_SIZES_BOTH | CABLE_SIZES_BAU_ONLY
TERMINAL_SIZES = {4, 6, 8, 12}
TEATHER_OPTIONS = {12, 24, 36, 48}  # Strand counts (ribbon increments)


def calculate_terminal_suggestion(assignment_count: int) -> int:
    """
    Calculate suggested terminal size based on 1.5 fibers per lot.
    
    Args:
        assignment_count: Number of lots assigned to terminal
        
    Returns:
        Suggested terminal size (4, 6, 8, or 12)
    """
    if assignment_count == 0:
        return 4
    
    required_fibers = ceil(assignment_count * 1.5)
    
    # Find smallest terminal size that fits
    for size in sorted(TERMINAL_SIZES):
        if size >= required_fibers:
            return size
    
    return 12  # Max size


def validate_cable_type_size(cable_type: str, cable_size: int) -> bool:
    """
    Validate cable type/size combination.
    
    Args:
        cable_type: "BAU" or "FNAP"
        cable_size: Cable size in strands
        
    Returns:
        True if valid combination, False otherwise
    """
    if cable_size not in CABLE_SIZES_ALL:
        return False
    
    if cable_type == "FNAP":
        return cable_size in CABLE_SIZES_BOTH
    elif cable_type == "BAU":
        return cable_size in CABLE_SIZES_ALL
    
    return False


def get_valid_cable_sizes(cable_type: str) -> List[int]:
    """
    Get valid cable sizes for a given type.
    
    Args:
        cable_type: "BAU" or "FNAP"
        
    Returns:
        List of valid sizes
    """
    if cable_type == "FNAP":
        return sorted(CABLE_SIZES_BOTH)
    elif cable_type == "BAU":
        return sorted(CABLE_SIZES_ALL)
    
    return []


def calculate_cable_total_count(
    cable_id: int,
    terminals_in_cable: List[Dict],
    teathers_from: List[Dict],
    teathers_to: List[Dict]
) -> int:
    """
    Calculate total strand count needed for a cable.
    
    Accounts for:
    - Terminal assignments (sum of actual terminal sizes)
    - Teathers diverted FROM this cable
    - Teathers received INTO this cable
    
    Args:
        cable_id: Cable ID
        terminals_in_cable: List of terminal configs assigned to this cable
        teathers_from: Teather splicers originating from this cable
        teathers_to: Teather splicers feeding into this cable
        
    Returns:
        Total strand count needed
    """
    # Base count from terminals
    terminal_count = sum(t.get('actual_size', t.get('suggested_size', 0)) for t in terminals_in_cable)
    
    # Add teathers diverted FROM this cable
    diverted_out = sum(t.get('divert_count', 0) for t in teathers_from)
    
    # Add teathers received INTO this cable
    diverted_in = sum(t.get('divert_count', 0) for t in teathers_to)
    
    total = terminal_count + diverted_out + diverted_in
    
    return total


def suggest_cable_size(total_count: int, cable_type: str) -> int:
    """
    Suggest cable size based on total count needed.
    
    Args:
        total_count: Total strand count needed
        cable_type: "BAU" or "FNAP"
        
    Returns:
        Suggested cable size (smallest size >= total_count)
    """
    valid_sizes = get_valid_cable_sizes(cable_type)
    
    for size in valid_sizes:
        if size >= total_count:
            return size
    
    return valid_sizes[-1] if valid_sizes else 24  # Return largest if needed


def validate_no_circular_teathers(teathers: List[Dict]) -> bool:
    """
    Validate that teathers don't form circular references.
    
    Args:
        teathers: List of teather splicer configs
        
    Returns:
        True if no circular references, False otherwise
    """
    # Build adjacency list
    graph = {}
    for t in teathers:
        cable_id = t.get('cable_id')
        target_id = t.get('target_cable_id')
        if cable_id == target_id:
            return False  # Self-reference
        if cable_id not in graph:
            graph[cable_id] = []
        graph[cable_id].append(target_id)
    
    # DFS to detect cycles
    def has_cycle(node, visited, rec_stack):
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if has_cycle(neighbor, visited, rec_stack):
                    return True
            elif neighbor in rec_stack:
                return True
        
        rec_stack.remove(node)
        return False
    
    visited = set()
    for node in graph:
        if node not in visited:
            if has_cycle(node, visited, set()):
                return False
    
    return True
