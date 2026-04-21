import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, formatApiErrorDetail } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import PageHeader from "../components/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const Pane = ({ title, children }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-5">
    <div className="overline mb-4">{title}</div>
    {children}
  </div>
);

const Row = ({ label, onDelete, testid }) => (
  <div className="flex items-center justify-between border-b border-zinc-100 py-2" data-testid={testid}>
    <span className="text-sm">{label}</span>
    <button onClick={onDelete} className="text-zinc-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
  </div>
);

export default function Masters() {
  const [branches, setBranches] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  const [newBranch, setNewBranch] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newVariant, setNewVariant] = useState("");

  const load = () => {
    api.get("/branches").then((r) => setBranches(r.data));
    api.get("/brands").then((r) => setBrands(r.data));
    api.get("/colors").then((r) => setColors(r.data));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedBrand) api.get("/models", { params: { brand_id: selectedBrand } }).then((r) => setModels(r.data));
    else setModels([]);
    setSelectedModel("");
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedModel) api.get("/variants", { params: { model_id: selectedModel } }).then((r) => setVariants(r.data));
    else setVariants([]);
  }, [selectedModel]);

  const add = async (url, body, reset, after) => {
    try {
      await api.post(url, body);
      reset();
      toast.success("Added");
      after && after();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const del = async (url, after) => {
    try { await api.delete(url); toast.success("Removed"); after && after(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("nav.masters")} subtitle="Configuration — brands, models, variants, colors" sticky />
      <div className="p-3 sm:p-6 max-w-[1300px] mx-auto w-full">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Pane title="Branches">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Add branch..." value={newBranch} onChange={(e) => setNewBranch(e.target.value)} data-testid="new-branch-input" />
            <Button onClick={() => add("/branches", { name: newBranch }, () => setNewBranch(""), load)} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-branch-btn">Add</Button>
          </div>
          {branches.map((b) => <Row key={b.id} label={b.name} onDelete={() => del(`/branches/${b.id}`, load)} testid={`branch-${b.id}`} />)}
        </Pane>

        <Pane title="Brands">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Add brand..." value={newBrand} onChange={(e) => setNewBrand(e.target.value)} data-testid="new-brand-input" />
            <Button onClick={() => add("/brands", { name: newBrand }, () => setNewBrand(""), load)} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-brand-btn">Add</Button>
          </div>
          {brands.map((b) => <Row key={b.id} label={b.name} onDelete={() => del(`/brands/${b.id}`, load)} testid={`brand-${b.id}`} />)}
        </Pane>

        <Pane title="Colors">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Add color..." value={newColor} onChange={(e) => setNewColor(e.target.value)} data-testid="new-color-input" />
            <Button onClick={() => add("/colors", { name: newColor }, () => setNewColor(""), load)} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-color-btn">Add</Button>
          </div>
          {colors.map((c) => <Row key={c.id} label={c.name} onDelete={() => del(`/colors/${c.id}`, load)} testid={`color-${c.id}`} />)}
        </Pane>

        <Pane title="Models">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="mb-3" data-testid="brand-filter-select"><SelectValue placeholder="Pick a brand" /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedBrand && (
            <>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Add model..." value={newModel} onChange={(e) => setNewModel(e.target.value)} data-testid="new-model-input" />
                <Button
                  onClick={() => add("/models", { name: newModel, brand_id: selectedBrand }, () => setNewModel(""),
                    () => api.get("/models", { params: { brand_id: selectedBrand } }).then((r) => setModels(r.data)))}
                  className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-model-btn"
                >Add</Button>
              </div>
              {models.map((m) => (
                <Row
                  key={m.id}
                  label={m.name}
                  onDelete={() => del(`/models/${m.id}`,
                    () => api.get("/models", { params: { brand_id: selectedBrand } }).then((r) => setModels(r.data)))}
                  testid={`model-${m.id}`}
                />
              ))}
            </>
          )}
        </Pane>

        <Pane title="Variants">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="mb-3" data-testid="model-filter-select"><SelectValue placeholder="Pick a model" /></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedModel && (
            <>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Add variant..." value={newVariant} onChange={(e) => setNewVariant(e.target.value)} data-testid="new-variant-input" />
                <Button
                  onClick={() => add("/variants", { name: newVariant, model_id: selectedModel }, () => setNewVariant(""),
                    () => api.get("/variants", { params: { model_id: selectedModel } }).then((r) => setVariants(r.data)))}
                  className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-variant-btn"
                >Add</Button>
              </div>
              {variants.map((v) => (
                <Row
                  key={v.id}
                  label={v.name}
                  onDelete={() => del(`/variants/${v.id}`,
                    () => api.get("/variants", { params: { model_id: selectedModel } }).then((r) => setVariants(r.data)))}
                  testid={`variant-${v.id}`}
                />
              ))}
            </>
          )}
        </Pane>
      </div>
      </div>
    </>
  );
}
