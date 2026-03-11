import { type DdbObj, type DdbValue } from 'dolphindb/browser.js'

import { Obj, type DdbObjRef } from '@/obj.tsx'

import { model } from '@model'

import { ExportCsv } from '@components/ExportCsv.tsx'
import { LineageGraph } from '@/lineage/index.tsx'

import { marked } from 'marked'

import { useEffect, useRef } from 'react'

import { shell } from './model.ts'


export function DataView () {
    const { result } = shell.use(['result'])
    const { options, product_name } = model.use(['options', 'product_name'])
    const containerRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => {
        if (result?.type === 'stream' && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [result])

    return <div
        ref={containerRef}
        className='dataview obj-result themed embed'
        role='region'
        tabIndex={0}
        aria-label='Output'
    >{
        (() => {
            if (!result)
                return
            
            const { type } = result
            
            if (type === 'lineage')
                return <LineageGraph />
            
            if (type === 'stream') {
                const { text, error } = result
                return <div className="stream-result" style={{ padding: '15px' }}>
                    <div className='markdown' dangerouslySetInnerHTML={{ __html: text ? marked.parse(text as string) as string : '' }} />
                    {error && <div className='error' style={{ color: 'var(--ant-error-color, #ff4d4f)', marginTop: '10px' }}>{error}</div>}
                </div>
            }
            
            const { data } = result
            
            // local
            // if (data.form === DdbForm.chart) {
            //     let v = (data as DdbObj).value as DdbChartValue
            //     v.type = DdbChartType.surface
            // }
            
            return <Obj
                ddb={model.ddb}
                ctx='embed'
                options={options}
                ExportCsv={ExportCsv}
                product_name={product_name}
                assets_root={model.assets_root}
                font={model.shf ? 'MyFont' : undefined}
                dark={false}
                {...type === 'object' ?
                    { obj: data as DdbObj<DdbValue> }
                :
                    { objref: data as DdbObjRef<DdbValue> }}
            />
        })()
    }</div>
}
