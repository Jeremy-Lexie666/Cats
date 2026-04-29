import { buildDayOptions, buildMonthOptions, buildYearOptions, getDatePickerState } from "../../utils/date-picker";

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: "选择日期"
    },
    value: {
      type: String,
      value: ""
    }
  },
  data: {
    years: buildYearOptions(),
    months: buildMonthOptions(),
    days: buildDayOptions(new Date().getFullYear(), new Date().getMonth() + 1),
    pickerValue: [30, new Date().getMonth(), Math.max(new Date().getDate() - 1, 0)]
  },
  observers: {
    "visible, value": function (visible: boolean, value: string) {
      if (!visible) return;
      const next = getDatePickerState(value);
      this.setData({
        years: next.years,
        months: next.months,
        days: next.days,
        pickerValue: next.pickerValue
      });
    }
  },
  methods: {
    handleMaskTap() {
      this.triggerEvent("close");
    },
    handlePickerChange(event: WechatMiniprogram.CustomEvent) {
      const value = (event.detail.value || []) as [number, number, number];
      const years = this.data.years as string[];
      const months = this.data.months as string[];
      const nextYear = years[value[0]] || years[0];
      const nextMonth = months[value[1]] || months[0];
      const nextDays = buildDayOptions(Number(nextYear), Number(nextMonth));
      const safeDayIndex = Math.min(value[2] || 0, nextDays.length - 1);
      this.setData({
        days: nextDays,
        pickerValue: [value[0] || 0, value[1] || 0, safeDayIndex]
      });
    },
    handleCancel() {
      this.triggerEvent("close");
    },
    handleConfirm() {
      const years = this.data.years as string[];
      const months = this.data.months as string[];
      const days = this.data.days as string[];
      const [yearIndex, monthIndex, dayIndex] = this.data.pickerValue as [number, number, number];
      const date = `${years[yearIndex] || years[0]}-${months[monthIndex] || months[0]}-${days[dayIndex] || days[0]}`;
      this.triggerEvent("confirm", { value: date });
    }
  }
});
