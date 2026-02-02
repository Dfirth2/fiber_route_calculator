"""Unit tests for cable configuration service."""
import pytest
from app.services.cable_service import (
    calculate_terminal_suggestion,
    validate_cable_type_size,
    get_valid_cable_sizes,
    calculate_cable_total_count,
    suggest_cable_size,
    validate_no_circular_teathers,
    CABLE_SIZES_BOTH,
    CABLE_SIZES_BAU_ONLY,
    TERMINAL_SIZES
)


class TestTerminalSizing:
    """Test terminal sizing calculation."""
    
    def test_zero_assignments(self):
        """Test zero assignments defaults to smallest size."""
        assert calculate_terminal_suggestion(0) == 4
    
    def test_one_assignment(self):
        """1 lot × 1.5 = 1.5, rounds to 2 fibers, fits in 4."""
        assert calculate_terminal_suggestion(1) == 4
    
    def test_two_assignments(self):
        """2 lots × 1.5 = 3 fibers, fits in 4."""
        assert calculate_terminal_suggestion(2) == 4
    
    def test_three_assignments(self):
        """3 lots × 1.5 = 4.5, rounds to 5 fibers, fits in 6."""
        assert calculate_terminal_suggestion(3) == 6
    
    def test_four_assignments(self):
        """4 lots × 1.5 = 6 fibers, fits in 6."""
        assert calculate_terminal_suggestion(4) == 6
    
    def test_five_assignments(self):
        """5 lots × 1.5 = 7.5, rounds to 8 fibers, fits in 8."""
        assert calculate_terminal_suggestion(5) == 8
    
    def test_eight_assignments(self):
        """8 lots × 1.5 = 12 fibers, fits in 12."""
        assert calculate_terminal_suggestion(8) == 12
    
    def test_nine_assignments(self):
        """9 lots × 1.5 = 13.5, rounds to 14 fibers, exceeds 12, max is 12."""
        assert calculate_terminal_suggestion(9) == 12


class TestCableTypeValidation:
    """Test cable type/size validation."""
    
    def test_fnap_valid_sizes(self):
        """FNAP allows 24, 48, 72, 144, 288, 432."""
        for size in CABLE_SIZES_BOTH:
            assert validate_cable_type_size("FNAP", size)
    
    def test_fnap_invalid_sizes(self):
        """FNAP does not allow 216, 864."""
        for size in CABLE_SIZES_BAU_ONLY:
            assert not validate_cable_type_size("FNAP", size)
    
    def test_bau_valid_sizes(self):
        """BAU allows all sizes."""
        for size in CABLE_SIZES_BOTH | CABLE_SIZES_BAU_ONLY:
            assert validate_cable_type_size("BAU", size)
    
    def test_invalid_size(self):
        """Invalid sizes rejected."""
        assert not validate_cable_type_size("BAU", 100)
        assert not validate_cable_type_size("FNAP", 100)
    
    def test_invalid_type(self):
        """Invalid types rejected."""
        assert not validate_cable_type_size("INVALID", 24)


class TestGetValidCableSizes:
    """Test getting valid cable sizes by type."""
    
    def test_fnap_sizes(self):
        """FNAP returns both type sizes."""
        sizes = get_valid_cable_sizes("FNAP")
        assert set(sizes) == CABLE_SIZES_BOTH
        assert sizes == sorted(CABLE_SIZES_BOTH)
    
    def test_bau_sizes(self):
        """BAU returns all sizes."""
        sizes = get_valid_cable_sizes("BAU")
        assert set(sizes) == CABLE_SIZES_BOTH | CABLE_SIZES_BAU_ONLY
        assert sizes == sorted(CABLE_SIZES_BOTH | CABLE_SIZES_BAU_ONLY)
    
    def test_invalid_type(self):
        """Invalid type returns empty."""
        assert get_valid_cable_sizes("INVALID") == []


class TestCableTotalCount:
    """Test cable total strand count calculation."""
    
    def test_terminals_only(self):
        """Count terminals without teathers."""
        terminals = [
            {'actual_size': 6},
            {'actual_size': 8}
        ]
        total = calculate_cable_total_count(1, terminals, [], [])
        assert total == 14
    
    def test_terminals_with_suggested_size(self):
        """Use suggested size if actual not available."""
        terminals = [
            {'suggested_size': 6},
            {'actual_size': 8}
        ]
        total = calculate_cable_total_count(1, terminals, [], [])
        assert total == 14
    
    def test_with_teather_out(self):
        """Include diverted out counts."""
        terminals = [{'actual_size': 6}]
        teathers_from = [{'divert_count': 12}]
        total = calculate_cable_total_count(1, terminals, teathers_from, [])
        assert total == 18  # 6 + 12
    
    def test_with_teather_in(self):
        """Include diverted in counts."""
        terminals = [{'actual_size': 6}]
        teathers_to = [{'divert_count': 24}]
        total = calculate_cable_total_count(1, terminals, [], teathers_to)
        assert total == 30  # 6 + 24
    
    def test_with_multiple_teathers(self):
        """Multiple teathers both directions."""
        terminals = [{'actual_size': 6}]
        teathers_from = [{'divert_count': 12}, {'divert_count': 12}]
        teathers_to = [{'divert_count': 24}]
        total = calculate_cable_total_count(1, terminals, teathers_from, teathers_to)
        assert total == 54  # 6 + 12 + 12 + 24
    
    def test_empty_terminals(self):
        """Only teathers, no terminals."""
        teathers_from = [{'divert_count': 12}]
        teathers_to = [{'divert_count': 24}]
        total = calculate_cable_total_count(1, [], teathers_from, teathers_to)
        assert total == 36  # 0 + 12 + 24


class TestSuggestCableSize:
    """Test cable size suggestion."""
    
    def test_fits_in_24(self):
        """Count 20 fits in 24."""
        assert suggest_cable_size(20, "BAU") == 24
        assert suggest_cable_size(20, "FNAP") == 24
    
    def test_needs_48(self):
        """Count 30 needs 48."""
        assert suggest_cable_size(30, "BAU") == 48
        assert suggest_cable_size(30, "FNAP") == 48
    
    def test_fnap_largest(self):
        """FNAP maxes at 432."""
        assert suggest_cable_size(500, "FNAP") == 432
    
    def test_bau_can_go_higher(self):
        """BAU can suggest 864."""
        assert suggest_cable_size(500, "BAU") == 864
    
    def test_zero_count_smallest(self):
        """Zero count returns smallest size."""
        assert suggest_cable_size(0, "BAU") == 24


class TestCircularTeatherDetection:
    """Test circular reference detection."""
    
    def test_no_teathers(self):
        """Empty list is valid."""
        assert validate_no_circular_teathers([])
    
    def test_single_teather_valid(self):
        """Single teather is valid."""
        teathers = [{'cable_id': 1, 'target_cable_id': 2, 'divert_count': 12}]
        assert validate_no_circular_teathers(teathers)
    
    def test_self_reference(self):
        """Self-reference is invalid."""
        teathers = [{'cable_id': 1, 'target_cable_id': 1, 'divert_count': 12}]
        assert not validate_no_circular_teathers(teathers)
    
    def test_direct_cycle(self):
        """Direct cycle: 1->2->1."""
        teathers = [
            {'cable_id': 1, 'target_cable_id': 2, 'divert_count': 12},
            {'cable_id': 2, 'target_cable_id': 1, 'divert_count': 12}
        ]
        assert not validate_no_circular_teathers(teathers)
    
    def test_long_cycle(self):
        """Long cycle: 1->2->3->1."""
        teathers = [
            {'cable_id': 1, 'target_cable_id': 2, 'divert_count': 12},
            {'cable_id': 2, 'target_cable_id': 3, 'divert_count': 12},
            {'cable_id': 3, 'target_cable_id': 1, 'divert_count': 12}
        ]
        assert not validate_no_circular_teathers(teathers)
    
    def test_valid_chain(self):
        """Valid chain: 1->2->3->4 (no cycle)."""
        teathers = [
            {'cable_id': 1, 'target_cable_id': 2, 'divert_count': 12},
            {'cable_id': 2, 'target_cable_id': 3, 'divert_count': 12},
            {'cable_id': 3, 'target_cable_id': 4, 'divert_count': 12}
        ]
        assert validate_no_circular_teathers(teathers)
    
    def test_tree_structure(self):
        """Tree structure (multiple sources to one target) is valid."""
        teathers = [
            {'cable_id': 1, 'target_cable_id': 4, 'divert_count': 12},
            {'cable_id': 2, 'target_cable_id': 4, 'divert_count': 12},
            {'cable_id': 3, 'target_cable_id': 4, 'divert_count': 12}
        ]
        assert validate_no_circular_teathers(teathers)
