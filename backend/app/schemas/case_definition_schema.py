from typing import List, Literal, Optional, Union, Any
from pydantic import BaseModel, Field

# Single Rule Types

class BaseRule(BaseModel):
    enabled: bool = True

class TimeRule(BaseRule):
    type: Literal["time"]
    column: Optional[str] = None
    operator: Optional[str] = None  # between, before, after, on, not_missing
    start: Optional[str] = None
    end: Optional[str] = None
    value: Optional[str] = None  # for before, after, on

class PlaceRule(BaseRule):
    type: Literal["place"]
    column: Optional[str] = None
    operator: Optional[str] = None  # equals, not_equals, in, not_in, contains, not_missing
    value: Optional[str] = None
    values: Optional[List[str]] = None

class SymptomAnyRule(BaseRule):
    type: Literal["symptom_any"]
    columns: List[str]
    minimum_required: int = 1

class SymptomAllRule(BaseRule):
    type: Literal["symptom_all"]
    columns: List[str]

class SymptomNOfMRule(BaseRule):
    type: Literal["symptom_n_of_m"]
    columns: List[str]
    minimum_required: int

class SymptomBinaryRule(BaseRule):
    type: Literal["symptom_binary"]
    columns: List[str]
    logic: Literal["AND", "OR"] = "OR"

class NumericSymptomRule(BaseRule):
    type: Literal["numeric_symptom"]
    column: str
    operator: str  # >=, >, =, <, <=, between
    value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None

class LabRule(BaseRule):
    type: Literal["lab"]
    column: str
    operator: str
    value: Optional[Any] = None
    values: Optional[List[Any]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None

# We use forward references for recursive types
class RuleGroup(BaseRule):
    type: Literal["place_group", "clinical_or_lab_group", "group"]
    logic: Literal["AND", "OR"] = "AND"
    rules: List[Any]  # Will be evaluated at runtime, or we can union all types

RuleType = Union[
    TimeRule, PlaceRule, SymptomAnyRule, SymptomAllRule, SymptomNOfMRule,
    NumericSymptomRule, LabRule, SymptomBinaryRule, RuleGroup
]

# Workaround for recursive type hinting in Pydantic v2
RuleGroup.model_rebuild()

class CaseDefinitionDraft(BaseModel):
    case_definition_name: str = "Draft Case Definition"
    output_column: str = "met_case_def"
    version: str = "v1"
    logic: Literal["AND", "OR"] = "AND"
    rules: List[RuleType] = Field(default_factory=list)

class ApplyCaseDefinitionRequest(BaseModel):
    case_definition_name: str
    rule_json: CaseDefinitionDraft
    output_column: str = "met_case_def"

class PreviewCaseDefinitionRequest(BaseModel):
    rule_json: CaseDefinitionDraft
