<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">LITERASI PERATURAN</h3>
                            <div class="card-tools">
                                <a href="<?= site_url('Administrator/tambah_peraturan') ?>" class="btn btn-tool">
                                    <i class="fas fa-chalkboard-teacher"></i>
                                </a>

                            </div>
                        </div>
                        <div class="card-body">
                            <table class="table table-stripped">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Gambar Literasi</th>
                                        <th>Judul Literasi</th>
                                        <th>Tanggal Upload</th>
                                        <th>View</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php $urut = 1;
                                    foreach ($literasi as $l) { ?>
                                        <tr>
                                            <td><?= $urut; ?></td>
                                            <td>
                                                <img width="100px" src="<?= base_url() ?>assets/plugin_video/img/<?= $l->gambar; ?>">
                                            </td>
                                            <td><?= $l->nama_peraturan; ?></td>
                                            <td><?= date('d M Y', strtotime($l->tgl_peraturan)); ?></td>
                                            <td><?= $l->view; ?> <i class="fas fa-users"></i></td>
                                            <td>
                                                <a class="btn btn-success btn-sm" href="<?= site_url('Administrator/edit_aturan/' . $l->id_peraturan) ?>"><i class="fas fa-edit"></i></a>
                                                <a class="btn btn-danger btn-sm" href="<?= site_url('Administrator/hapus_aturan/' . $l->id_peraturan) ?>"><i class="fas fa-trash"></i></a>
                                            </td>
                                        </tr>
                                    <?php $urut++;
                                    }    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>