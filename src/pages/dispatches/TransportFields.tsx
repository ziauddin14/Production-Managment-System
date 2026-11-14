import { FieldError, inputClass } from '../../components/ui';

/** Bilty number, transporter, vehicle, freight and notes — shared by create and edit. */
export function TransportFields({
  values,
  setters,
  errors,
}: {
  values: {
    biltyNo: string;
    transporterName: string;
    vehicleNo: string;
    freightAmount: string;
    notes: string;
  };
  setters: {
    setBiltyNo(v: string): void;
    setTransporterName(v: string): void;
    setVehicleNo(v: string): void;
    setFreightAmount(v: string): void;
    setNotes(v: string): void;
  };
  errors: Record<string, string>;
}) {
  const field = (
    id: string,
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    maxLength: number,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${id}-error` : undefined}
        className={`${inputClass(Boolean(errors[key]))} mt-1`}
      />
      <FieldError id={`${id}-error`} message={errors[key]} />
    </div>
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {field('bilty-no', 'biltyNo', 'Bilty no.', values.biltyNo, setters.setBiltyNo, 50)}
        {field(
          'transporter',
          'transporterName',
          'Transporter',
          values.transporterName,
          setters.setTransporterName,
          100,
        )}
        {field(
          'vehicle-no',
          'vehicleNo',
          'Vehicle no.',
          values.vehicleNo,
          setters.setVehicleNo,
          30,
        )}
        <div>
          <label htmlFor="freight" className="block text-sm font-medium text-slate-700">
            Freight (PKR)
          </label>
          <input
            id="freight"
            type="number"
            min={0}
            step="0.01"
            value={values.freightAmount}
            onChange={(e) => setters.setFreightAmount(e.target.value)}
            aria-invalid={Boolean(errors.freightAmount)}
            aria-describedby={errors.freightAmount ? 'freight-error' : undefined}
            className={`${inputClass(Boolean(errors.freightAmount))} mt-1`}
          />
          <FieldError id="freight-error" message={errors.freightAmount} />
        </div>
      </div>
      <div>
        <label htmlFor="dispatch-notes" className="block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="dispatch-notes"
          rows={2}
          maxLength={1000}
          value={values.notes}
          onChange={(e) => setters.setNotes(e.target.value)}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? 'dispatch-notes-error' : undefined}
          className={`${inputClass(Boolean(errors.notes))} mt-1`}
        />
        <FieldError id="dispatch-notes-error" message={errors.notes} />
      </div>
    </>
  );
}
