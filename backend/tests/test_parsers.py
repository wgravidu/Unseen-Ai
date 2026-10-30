import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

import main


class AnalysisParserTests(unittest.TestCase):
    def test_valid_analysis_parses(self):
        payload = {
            "is_wall_visible": True,
            "observations": ["Dark patch near the floor"],
            "uncertainties": [],
            "possible_causes": [{"cause": "Surface moisture", "likelihood": "medium"}],
            "needs_more_evidence": False,
            "followup_request": None,
            "next_best_view": None,
            "safe_next_steps": ["Keep the area dry"],
            "confidence": 0.72,
        }
        result = main.parse_analysis(json.dumps(payload))
        self.assertTrue(result.is_wall_visible)
        self.assertEqual(result.confidence, 0.72)

    def test_misplaced_visual_guide_dict_is_repaired(self):
        payload = {
            "is_wall_visible": False,
            "needs_more_evidence": True,
            "followup_request": {"type": "photo", "text": "Upload a wall photo"},
            "next_best_view": {
                "instruction": "Take a straight photo",
                "visual_guide": {"x_min": 0, "y_min": 0, "x_max": 1000, "y_max": 1000},
                "reason": "No wall visible",
                "expected_evidence": "Wall surface",
                "priority": "high",
            },
            "confidence": 95,
        }
        result = main.parse_analysis(json.dumps(payload))
        self.assertEqual(result.next_best_view.visual_guide, "box")
        self.assertEqual(result.next_best_view.focus_area["x_max"], 1000.0)
        self.assertEqual(result.confidence, 0.95)

    def test_needs_evidence_without_guidance_fails(self):
        with self.assertRaises(HTTPException) as raised:
            main.parse_analysis('{"is_wall_visible":true,"needs_more_evidence":true,"confidence":0.5}')
        self.assertEqual(raised.exception.status_code, 502)


class HighlightParserTests(unittest.TestCase):
    def test_zero_to_one_coordinates_are_scaled(self):
        result = main.parse_highlight(
            '{"wall_visible":true,"regions":[{"label":"crack line","x_min":0.1,"y_min":0.2,'
            '"x_max":0.4,"y_max":0.6,"confidence":82}],"summary":"One crack"}'
        )
        self.assertEqual(len(result["regions"]), 1)
        self.assertEqual(result["regions"][0]["x_min"], 100)
        self.assertEqual(result["regions"][0]["confidence"], 0.82)

    def test_whole_image_box_is_discarded(self):
        result = main.parse_highlight(
            '{"wall_visible":true,"regions":[{"label":"wall","x_min":0,"y_min":0,'
            '"x_max":1000,"y_max":1000,"confidence":0.9}],"summary":"Whole wall"}'
        )
        self.assertEqual(result["regions"], [])

    def test_empty_regions_are_allowed(self):
        result = main.parse_highlight('{"wall_visible":false,"regions":[],"summary":"No wall"}')
        self.assertFalse(result["wall_visible"])
        self.assertEqual(result["regions"], [])


if __name__ == "__main__":
    unittest.main()
