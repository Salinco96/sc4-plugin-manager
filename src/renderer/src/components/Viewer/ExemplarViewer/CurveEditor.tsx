import { MouseEvent, useInsertionEffect, useMemo, useRef, useState } from "react"

import { Box, useTheme } from "@mui/material"
import { default as ReactApexChart } from "react-apexcharts"

import { ExemplarProperty } from "@common/exemplars"
import { isDefined } from "@common/utils/types"

import { getItemInfo, getMax, getMin, getStep } from "./utils"

export interface CurveEditorProps {
  onChange: (value: number[]) => void
  original?: number[]
  property: ExemplarProperty
  value: number[]
}

export function CurveEditor({
  onChange,
  original,
  property,
  value,
}: CurveEditorProps): JSX.Element {
  const theme = useTheme()

  const xItemInfo = getItemInfo(property, 0)
  const yItemInfo = getItemInfo(property, 1)

  const xMin = xItemInfo?.min ?? getMin(property.type)
  const xMax = xItemInfo?.max ?? getMax(property.type)
  const yMin = yItemInfo?.min ?? getMin(property.type)
  const yMax = yItemInfo?.max ?? getMax(property.type)
  const xStep = xItemInfo?.step ?? getStep(property.type, xMax) ?? 0
  const yStep = yItemInfo?.step ?? getStep(property.type, yMax) ?? 0

  const { series, xAxis, yAxis } = useMemo(() => {
    const currentValues = toSeries(value)
    const originalValues = original && toSeries(original)

    const allValues = originalValues ? currentValues.concat(originalValues) : currentValues

    const series = [
      {
        data: currentValues,
        name: "Current",
        zIndex: 1,
      },
      originalValues && {
        data: originalValues,
        name: "Original",
        zIndex: 0,
      },
    ].filter(isDefined)

    const xAxis = getAxisOptions(
      allValues.map(([x]) => x),
      xMin,
      xMax,
      xStep,
      20,
    )

    const yAxis = getAxisOptions(
      allValues.map(([, y]) => y),
      yMin,
      yMax,
      yStep,
      10,
    )

    const currentLastValue = currentValues[currentValues.length - 1]
    if (currentLastValue[0] !== xAxis.max) {
      currentValues.push([xAxis.max, currentLastValue[1]])
    }

    if (originalValues) {
      const originalLastValue = originalValues[originalValues.length - 1]
      if (originalLastValue[0] !== xAxis.max) {
        originalValues.push([xAxis.max, originalLastValue[1]])
      }
    }

    return { series, xAxis, yAxis }
  }, [original, value, xMax, xMin, xStep, yMax, yMin, yStep])

  const mousePos = useRef<{ xRate: number; yRate: number }>()

  const [selected, setSelected] = useState<number>()
  const [isDragging, setDragging] = useState(false)

  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const dragFnRef = useRef(() => {})
  useInsertionEffect(() => {
    dragFnRef.current = () => {
      setDragging(true)

      if (mousePos.current && selected !== undefined) {
        const { xRate, yRate } = mousePos.current

        let xCoord = xAxis.min + Math.min(Math.max(xRate, 0), 1) * (xAxis.max - xAxis.min)
        let yCoord = yAxis.min + Math.min(Math.max(yRate, 0), 1) * (yAxis.max - yAxis.min)

        if (xStep) {
          xCoord = xStep * Math.round(xCoord / xStep)
        }

        if (yStep) {
          yCoord = yStep * Math.round(yCoord / yStep)
        }

        if (xRate >= 1.02) {
          xCoord += xStep
        } else if (xRate <= -0.02) {
          xCoord -= xStep
        }

        if (yRate >= 1.02) {
          yCoord += yStep
        } else if (yRate <= -0.02) {
          yCoord -= yStep
        }

        if (xMin !== undefined) {
          xCoord = Math.max(xCoord, xMin)
        }

        if (xMax !== undefined) {
          xCoord = Math.min(xCoord, xMax)
        }

        if (yMin !== undefined) {
          yCoord = Math.max(yCoord, yMin)
        }

        if (yMax !== undefined) {
          yCoord = Math.min(yCoord, yMax)
        }

        const current = series[0].data[selected]
        const xPrevious = value[selected * 2 - 2]
        const xNext = value[selected * 2 + 2]

        if (xPrevious !== undefined) {
          xCoord = Math.max(xCoord, xPrevious + xStep)
        }

        if (xNext !== undefined) {
          xCoord = Math.min(xCoord, xNext - xStep)
        }

        if (xCoord !== current[0] || yCoord !== current[1]) {
          const newValue = value.slice()
          newValue.splice(selected * 2, 2, xCoord, yCoord)
          onChange(newValue)
        }

        if (dragTimeoutRef.current !== undefined) {
          clearTimeout(dragTimeoutRef.current)
        }

        dragTimeoutRef.current = setTimeout(drag, 300)
      }
    }
  }, [selected, series, xMax, xMin, xStep, value, yMax, yMin, yStep])
  const drag = () => dragFnRef.current()

  const selectedX = selected !== undefined ? series[0].data[selected][0] : undefined
  const selectedY = selected !== undefined ? series[0].data[selected][1] : undefined

  return (
    <Box
      onMouseDown={() => {
        if (selected !== undefined && !isDragging) {
          drag()
        }
      }}
      onMouseUp={() => {
        if (dragTimeoutRef.current !== undefined) {
          clearTimeout(dragTimeoutRef.current)
        }

        setDragging(false)
      }}
      sx={{
        cursor:
          selected !== undefined ? (isDragging !== undefined ? "grabbing" : "grab") : undefined,
        "& .apexcharts-tooltip": {
          left: "60px !important",
          top: "40px !important",
        },
      }}
    >
      <ReactApexChart
        options={{
          annotations: {
            xaxis: [
              {
                borderWidth: 1,
                strokeDashArray: 0,
                x: 0,
              },
              isDragging && {
                borderWidth: isDragging ? 1 : 0,
                strokeDashArray: 3,
                x: selectedX,
              },
            ].filter(v => !!v),
            yaxis: [
              {
                borderWidth: 1,
                strokeDashArray: 0,
                y: 0,
              },
              isDragging && {
                borderWidth: 1,
                strokeDashArray: 3,
                y: selectedY,
              },
            ].filter(v => !!v),
            points: [
              selected !== undefined && {
                x: selectedX,
                y: selectedY,
                label: {
                  offsetY: -6,
                  text: `${selectedX} ; ${selectedY}`,
                },
                marker: {
                  size: 0,
                },
              },
            ].filter(v => !!v),
          },
          chart: {
            animations: {
              enabled: false,
              animateGradually: {
                enabled: false,
              },
              dynamicAnimation: {
                enabled: false,
              },
            },
            events: {
              mouseLeave() {
                if (dragTimeoutRef.current !== undefined) {
                  clearTimeout(dragTimeoutRef.current)
                }

                setDragging(false)
                setSelected(undefined)
              },
              mouseMove(event: MouseEvent) {
                const rect = event.currentTarget
                  .getElementsByClassName("apexcharts-grid")[0]
                  .getBoundingClientRect()

                const xPos = event.clientX - rect.left
                const yPos = event.clientY - rect.top
                const xRate = xPos / (rect.right - rect.left)
                const yRate = 1 - yPos / (rect.bottom - rect.top)

                mousePos.current = { xRate, yRate }

                if (isDragging) {
                  drag()
                } else {
                  const markers = event.currentTarget.querySelectorAll(
                    ".apexcharts-series[seriesName=Current] .apexcharts-marker",
                  )

                  const index = Array.from(markers).findIndex(marker => {
                    const rect = marker.getBoundingClientRect()

                    return (
                      event.clientX >= rect.left &&
                      event.clientX <= rect.right &&
                      event.clientY >= rect.top &&
                      event.clientY <= rect.bottom
                    )
                  })

                  if (index >= 0 && index < value.length / 2) {
                    setSelected(index)
                  } else {
                    setSelected(undefined)
                  }
                }
              },
            },
            selection: {
              enabled: false,
            },
            toolbar: {
              show: false,
            },
            zoom: {
              enabled: false,
            },
          },
          colors: [theme.palette.primary.main, theme.palette.secondary.main],
          grid: {
            show: true,
            strokeDashArray: 6,
            yaxis: {
              lines: {
                show: true,
              },
            },
          },
          legend: {
            onItemClick: {
              toggleDataSeries: false,
            },
            show: !!original,
          },
          markers: {
            discrete: Array.from({ length: value.length / 2 }, (i, n) => ({
              dataPointIndex: n,
              fillColor: theme.palette.primary.main,
              seriesIndex: 0,
              shape: "square",
              size: n === selected ? 6 : 4,
            })),
            hover: {
              size: 6,
            },
            size: 3,
            strokeWidth: 0,
          },
          stroke: {
            curve: "straight", // stepline
            dashArray: [0, 2],
            width: 2,
          },
          tooltip: {
            enabled: !isDragging,
            enabledOnSeries: [1],
            intersect: true,
            marker: {
              show: true,
            },
            shared: false,
            x: {
              show: true,
            },
          },
          xaxis: {
            ...xAxis,
            axisBorder: {
              show: false,
            },
            axisTicks: {
              show: true,
            },
            crosshairs: {
              show: !isDragging,
              width: 1,
            },
            labels: {
              hideOverlappingLabels: true,
              show: true,
            },
            tickAmount: xAxis.tickAmount - 1,
            title: {
              text: xItemInfo?.name,
            },
            tooltip: {
              enabled: false,
            },
          },
          yaxis: {
            ...yAxis,
            axisBorder: {
              show: false,
            },
            axisTicks: {
              show: false,
            },
            crosshairs: {
              show: true,
              stroke: {
                width: 1,
              },
            },
            labels: {
              show: true,
            },
            title: {
              text: yItemInfo?.name,
            },
          },
        }}
        series={series}
        type="line"
        width="100%"
      />
    </Box>
  )
}

function toSeries(values: number[]): [number, number][] {
  return Array.from(
    { length: Math.floor(values.length / 2) },
    (v, i) => [values[i * 2], values[i * 2 + 1]] as const,
  )
}

function getAxisOptions(
  values: number[],
  min: number | undefined,
  max: number | undefined,
  step: number,
  maxTicks: number,
): { decimalsInFloat: number; max: number; min: number; tickAmount: number } {
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (min === 0 && max === 255) {
    return { decimalsInFloat: 0, max, min, tickAmount: 17 }
  }

  if (min === 0 && max === 256) {
    return { decimalsInFloat: 0, max, min, tickAmount: 16 }
  }

  if (min === -127 && max === 127) {
    return { decimalsInFloat: 0, max, min, tickAmount: 16 }
  }

  if (minValue === 0 && maxValue === 0) {
    if (step === 1) {
      return { decimalsInFloat: 0, max: 100, min: min === 0 ? 0 : -100, tickAmount: 10 }
    } else {
      return { decimalsInFloat: 2, max: 1, min: min === 0 ? 0 : -1, tickAmount: 10 }
    }
  }

  const largest = Math.max(Math.abs(minValue), Math.abs(maxValue))
  const exponent = Math.floor(Math.log10(largest))
  const highestDigit = Math.floor(largest / 10 ** exponent)
  const scale = highestDigit < 6 ? 10 ** exponent : 10 ** (exponent + 1)

  const width = min === 0 ? 1 + Math.floor(largest / scale) : Math.ceil(largest / scale)

  const axisMin = Math.max(minValue >= 0 ? 0 : scale * -width, min ?? -Number.MAX_VALUE)
  const axisMax = Math.min(maxValue <= 0 ? 0 : scale * width, max ?? Number.MAX_VALUE)

  const range = axisMax - axisMin

  const tickAmount =
    step >= 1 && range <= maxTicks
      ? range
      : range / scale <= maxTicks / 10
        ? (range / scale) * 10
        : Math.max(range / scale, maxTicks)

  const tickInterval = range / tickAmount

  return {
    decimalsInFloat: step >= 1 ? 0 : Math.max(Math.ceil(-Math.log10(tickInterval)), 0),
    max: axisMax,
    min: axisMin,
    tickAmount: tickAmount,
  }
}
