"""Pydantic v2 request models.

Design note (important for parity): the Express backend performs almost no
request validation — any JSON object is accepted, unknown keys are kept, and
missing keys become null. A strict Pydantic model would reject such requests
with HTTP 422, which the React client (and the documented contract) does not
expect. Therefore every model here:

* makes all fields optional, and
* sets `model_config = ConfigDict(extra="allow")` so unknown keys are kept
  (they end up in the stored record, exactly like Express's spread operator).

The models still give you typed access, editor autocomplete and OpenAPI docs
(FastAPI serves them at /docs) without changing observable behaviour.

Endpoints whose Express counterpart merges a *completely arbitrary* body into
the stored record (the PUT update endpoints) accept a plain `dict` instead —
there is genuinely no schema to describe there.
"""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class _LenientModel(BaseModel):
    """Base for all request bodies: optional everything, unknown keys kept."""

    model_config = ConfigDict(extra="allow")

    def merged_dict(self) -> dict[str, Any]:
        """Declared fields + any extra keys, as a plain dict (JS spread)."""
        data = self.model_dump()
        if self.model_extra:
            data.update(self.model_extra)
        return data


class ChemicalIn(_LenientModel):
    """Body of POST /api/chemicals (all fields optional, like Express)."""

    chemical_id: Optional[str] = None
    nestle_id: Optional[str] = None
    name: Optional[str] = None
    cas_number: Optional[str] = None
    molecular_formula: Optional[str] = None
    molecular_weight: Optional[float] = None
    smiles: Optional[str] = None
    inchi: Optional[str] = None
    inchi_key: Optional[str] = None
    supplier: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class SampleIn(_LenientModel):
    """Body of POST /api/samples — Express spreads the whole body into the
    record, so extra keys are preserved via `extra="allow"`."""

    sample_id: Optional[str] = None
    identification: Optional[str] = None
    content_type: Optional[str] = None
    material_type: Optional[str] = None
    project_number: Optional[str] = None
    status: Optional[str] = None


class ScreeningIn(_LenientModel):
    """Body of POST /api/screening."""

    chemical_id: Optional[str] = None
    assay_name: Optional[str] = None
    assay_type: Optional[str] = None
    target: Optional[str] = None
    result: Optional[str] = None
    result_value: Optional[Any] = None
    result_unit: Optional[str] = None
    concentration: Optional[Any] = None
    concentration_unit: Optional[str] = None
    timepoint: Optional[Any] = None
    replicate: Optional[Any] = None
    plate_id: Optional[str] = None
    well_position: Optional[str] = None
    experiment_date: Optional[str] = None
    operator: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class ToxicologyIn(_LenientModel):
    """Body of POST /api/toxicology."""

    chemical_id: Optional[str] = None
    study_type: Optional[str] = None
    species: Optional[str] = None
    strain: Optional[str] = None
    sex: Optional[str] = None
    route_of_administration: Optional[str] = None
    duration: Optional[Any] = None
    duration_unit: Optional[str] = None
    dose: Optional[Any] = None
    dose_unit: Optional[str] = None
    endpoint: Optional[str] = None
    endpoint_value: Optional[Any] = None
    endpoint_unit: Optional[str] = None
    noael: Optional[Any] = None
    loael: Optional[Any] = None
    ld50: Optional[Any] = None
    study_reference: Optional[str] = None
    study_date: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class BulkDeleteChemicals(_LenientModel):
    chemical_ids: Optional[Any] = None  # validated by hand, like Express


class BulkUpdateChemicals(_LenientModel):
    chemical_ids: Optional[Any] = None
    updates: Optional[dict[str, Any]] = None


class BulkDeleteSamples(_LenientModel):
    sample_ids: Optional[Any] = None


class LinkChemicals(_LenientModel):
    chemical_ids: Optional[Any] = None
